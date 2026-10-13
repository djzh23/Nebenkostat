using System.Numerics;

namespace Backend.Domain;

public enum DistributionKey
{
    Flaeche,
    Personen,
    Einheiten,
}

public sealed record UnitInput(string Id, long AreaHundredths);

public sealed record TenancyInput(
    string Id,
    string UnitId,
    string TenantName,
    int Persons,
    long MonthlyPrepaymentCents,
    DateOnly StartDate,
    DateOnly? EndDate = null);

public sealed record CostItemInput(
    string Id,
    string Category,
    long AmountCents,
    DistributionKey DistributionKey);

public sealed record AllocationRequest(
    int BillingYear,
    IReadOnlyList<UnitInput> Units,
    IReadOnlyList<TenancyInput> Tenancies,
    IReadOnlyList<CostItemInput> Costs);

public sealed record AllocationLine(
    string? TenancyId,
    string Label,
    long AmountCents,
    int ActiveDays,
    int ActiveMonths,
    int PersonMonths,
    long AreaHundredths,
    string Formula);

public sealed record CostAllocation(
    CostItemInput Cost,
    IReadOnlyList<AllocationLine> Lines,
    long AllocatedCents,
    long VacancyCents);

public sealed record TenancySettlement(
    TenancyInput Tenancy,
    int ActiveDays,
    int ActiveMonths,
    long AllocatedCostCents,
    long PrepaidCents,
    long BalanceCents);

public sealed record AllocationResult(
    int BillingYear,
    int DaysInYear,
    IReadOnlyList<CostAllocation> Costs,
    IReadOnlyList<TenancySettlement> Tenancies);

public static class AllocationCalculator
{
    public static AllocationResult Calculate(AllocationRequest request)
    {
        ValidateRequest(request);

        var daysInYear = DateTime.IsLeapYear(request.BillingYear) ? 366 : 365;
        var unitById = request.Units.ToDictionary(unit => unit.Id);
        var activeTenancies = request.Tenancies
            .Select(tenancy => new ActiveTenancy(tenancy, GetActivePeriod(tenancy, request.BillingYear)))
            .Where(entry => entry.Period is not null)
            .ToArray();

        var totalAreaHundredths = request.Units.Sum(unit => unit.AreaHundredths);
        var totalPersonMonths = activeTenancies.Sum(entry => entry.Tenancy.Persons * entry.Period!.Value.Months);

        var costs = request.Costs
            .Select(cost => AllocateCost(
                cost,
                request,
                unitById,
                activeTenancies,
                daysInYear,
                totalAreaHundredths,
                totalPersonMonths))
            .ToArray();

        var tenancies = activeTenancies
            .Select(entry =>
            {
                var allocatedCostCents = costs
                    .SelectMany(cost => cost.Lines)
                    .Where(line => line.TenancyId == entry.Tenancy.Id)
                    .Sum(line => line.AmountCents);
                var prepaidCents = checked(entry.Tenancy.MonthlyPrepaymentCents * entry.Period!.Value.Months);

                return new TenancySettlement(
                    entry.Tenancy,
                    entry.Period.Value.Days,
                    entry.Period.Value.Months,
                    allocatedCostCents,
                    prepaidCents,
                    allocatedCostCents - prepaidCents);
            })
            .ToArray();

        return new AllocationResult(request.BillingYear, daysInYear, costs, tenancies);
    }

    private static CostAllocation AllocateCost(
        CostItemInput cost,
        AllocationRequest request,
        IReadOnlyDictionary<string, UnitInput> unitById,
        IReadOnlyList<ActiveTenancy> activeTenancies,
        int daysInYear,
        long totalAreaHundredths,
        int totalPersonMonths)
    {
        var lines = new List<AllocationLine>(activeTenancies.Count);

        foreach (var active in activeTenancies)
        {
            var tenancy = active.Tenancy;
            var period = active.Period!.Value;
            var unit = unitById[tenancy.UnitId];
            var amountCents = cost.DistributionKey switch
            {
                DistributionKey.Flaeche => RoundHalfUp(
                    BigInteger.Multiply(
                        BigInteger.Multiply(cost.AmountCents, unit.AreaHundredths),
                        period.Days),
                    BigInteger.Multiply(totalAreaHundredths, daysInYear)),
                DistributionKey.Personen => totalPersonMonths == 0
                    ? 0
                    : RoundHalfUp(
                        BigInteger.Multiply(cost.AmountCents, tenancy.Persons * period.Months),
                        totalPersonMonths),
                DistributionKey.Einheiten => RoundHalfUp(
                    BigInteger.Multiply(cost.AmountCents, period.Days),
                    BigInteger.Multiply(request.Units.Count, daysInYear)),
                _ => throw new ArgumentOutOfRangeException(nameof(cost.DistributionKey)),
            };

            var formula = cost.DistributionKey switch
            {
                DistributionKey.Flaeche =>
                    $"{cost.AmountCents} ct × {unit.AreaHundredths} m² × {period.Days} Tage ÷ ({totalAreaHundredths} m² × {daysInYear} Tage)",
                DistributionKey.Personen =>
                    $"{cost.AmountCents} ct × {tenancy.Persons} Personen × {period.Months} Monate ÷ {totalPersonMonths} Personen-Monate",
                DistributionKey.Einheiten =>
                    $"{cost.AmountCents} ct × {period.Days} Tage ÷ ({request.Units.Count} Einheiten × {daysInYear} Tage)",
                _ => throw new ArgumentOutOfRangeException(nameof(cost.DistributionKey)),
            };

            lines.Add(new AllocationLine(
                tenancy.Id,
                tenancy.TenantName,
                amountCents,
                period.Days,
                period.Months,
                tenancy.Persons * period.Months,
                unit.AreaHundredths,
                formula));
        }

        var allocatedCents = lines.Sum(line => line.AmountCents);
        var vacancyCents = cost.AmountCents - allocatedCents;
        lines.Add(new AllocationLine(
            null,
            "Leerstand (Vermieter)",
            vacancyCents,
            0,
            0,
            0,
            0,
            $"{cost.AmountCents} ct − {allocatedCents} ct"));

        return new CostAllocation(cost, lines, allocatedCents, vacancyCents);
    }

    private static void ValidateRequest(AllocationRequest request)
    {
        if (request.BillingYear is < 2000 or > 2100)
            throw new ArgumentOutOfRangeException(nameof(request.BillingYear));
        if (request.Units.Count == 0)
            throw new ArgumentException("Mindestens eine Einheit ist erforderlich.", nameof(request));
        if (request.Units.Any(unit => string.IsNullOrWhiteSpace(unit.Id) || unit.AreaHundredths <= 0))
            throw new ArgumentException("Einheiten benötigen eindeutige IDs und eine Fläche größer als null.", nameof(request));
        if (request.Units.Select(unit => unit.Id).Distinct(StringComparer.Ordinal).Count() != request.Units.Count)
            throw new ArgumentException("Einheiten-IDs müssen eindeutig sein.", nameof(request));
        if (request.Tenancies.Any(tenancy =>
                string.IsNullOrWhiteSpace(tenancy.Id) ||
                string.IsNullOrWhiteSpace(tenancy.UnitId) ||
                tenancy.Persons < 0 ||
                tenancy.MonthlyPrepaymentCents < 0 ||
                tenancy.EndDate < tenancy.StartDate))
            throw new ArgumentException("Mietverhältnisse enthalten ungültige Werte.", nameof(request));
        if (request.Tenancies.Select(tenancy => tenancy.Id).Distinct(StringComparer.Ordinal).Count() != request.Tenancies.Count)
            throw new ArgumentException("Mietverhältnis-IDs müssen eindeutig sein.", nameof(request));
        if (request.Tenancies.Any(tenancy => !request.Units.Any(unit => unit.Id == tenancy.UnitId)))
            throw new ArgumentException("Jedes Mietverhältnis muss zu einer vorhandenen Einheit gehören.", nameof(request));
        if (request.Costs.Any(cost => string.IsNullOrWhiteSpace(cost.Id) || cost.AmountCents < 0))
            throw new ArgumentException("Kostenpositionen benötigen IDs und einen Betrag ab null.", nameof(request));
        if (request.Costs.Select(cost => cost.Id).Distinct(StringComparer.Ordinal).Count() != request.Costs.Count)
            throw new ArgumentException("Kostenpositions-IDs müssen eindeutig sein.", nameof(request));
    }

    private static ActivePeriod? GetActivePeriod(TenancyInput tenancy, int year)
    {
        var yearStart = new DateOnly(year, 1, 1);
        var yearEnd = new DateOnly(year, 12, 31);
        var start = tenancy.StartDate > yearStart ? tenancy.StartDate : yearStart;
        var end = tenancy.EndDate is { } tenancyEnd && tenancyEnd < yearEnd ? tenancyEnd : yearEnd;
        if (end < start) return null;

        var months = 0;
        for (var month = 1; month <= 12; month++)
        {
            var monthStart = new DateOnly(year, month, 1);
            var monthEnd = monthStart.AddMonths(1).AddDays(-1);
            if (start <= monthEnd && end >= monthStart) months++;
        }

        return new ActivePeriod(end.DayNumber - start.DayNumber + 1, months);
    }

    private static long RoundHalfUp(BigInteger numerator, BigInteger denominator)
    {
        if (denominator <= 0) throw new ArgumentOutOfRangeException(nameof(denominator));
        return checked((long)((numerator * 2 + denominator) / (denominator * 2)));
    }

    private sealed record ActiveTenancy(TenancyInput Tenancy, ActivePeriod? Period);

    private readonly record struct ActivePeriod(int Days, int Months);
}
