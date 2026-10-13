using Backend.Domain;
using Xunit;

namespace Backend.Tests;

public sealed class AllocationCalculatorTests
{
    [Fact]
    public void AreaKeyUsesFixedTotalAreaAndShowsVacancy()
    {
        var result = Calculate(
            units: [new("eg", 6200), new("og", 11800)],
            tenancies: [FullYearTenancy("mieter-eg", "eg")],
            costs: [new("wasser", "wasser", 120_000, DistributionKey.Flaeche)]);

        var allocation = Assert.Single(result.Costs);
        Assert.Equal(41_333, allocation.Lines[0].AmountCents);
        Assert.Equal(78_667, allocation.VacancyCents);
        Assert.Equal(120_000, allocation.Lines.Sum(line => line.AmountCents));
    }

    [Fact]
    public void UnitKeyUsesActiveDaysAndUnitCount()
    {
        var result = Calculate(
            units: [new("eg", 6200), new("og", 11800)],
            tenancies: [new(
                "mieter-eg",
                "eg",
                "Mieter EG",
                1,
                0,
                new DateOnly(2025, 1, 1),
                new DateOnly(2025, 6, 30))],
            costs: [new("beleuchtung", "beleuchtung", 36_500, DistributionKey.Einheiten)]);

        var allocation = Assert.Single(result.Costs);
        Assert.Equal(9_050, allocation.Lines[0].AmountCents);
        Assert.Equal(27_450, allocation.VacancyCents);
        Assert.Equal(181, allocation.Lines[0].ActiveDays);
    }

    [Fact]
    public void PersonsKeyUsesPersonMonths()
    {
        var result = Calculate(
            units: [new("eg", 6200), new("og", 11800)],
            tenancies:
            [
                FullYearTenancy("mieter-eg", "eg", persons: 1),
                new(
                    "mieter-og",
                    "og",
                    "Mieter OG",
                    1,
                    0,
                    new DateOnly(2025, 1, 1),
                    new DateOnly(2025, 6, 30)),
            ],
            costs: [new("muell", "muellbeseitigung", 18_000, DistributionKey.Personen)]);

        var allocation = Assert.Single(result.Costs);
        Assert.Equal(12_000, allocation.Lines[0].AmountCents);
        Assert.Equal(6_000, allocation.Lines[1].AmountCents);
        Assert.Equal(0, allocation.VacancyCents);
        Assert.Equal(12, allocation.Lines[0].PersonMonths);
        Assert.Equal(6, allocation.Lines[1].PersonMonths);
    }

    [Fact]
    public void FullLeapYearTenancyHas366ActiveDays()
    {
        var result = Calculate(
            year: 2024,
            units: [new("eg", 6200)],
            tenancies: [new(
                "mieter-eg",
                "eg",
                "Mieter EG",
                1,
                0,
                new DateOnly(2024, 1, 1))],
            costs: [new("grundsteuer", "grundsteuer", 10_000, DistributionKey.Einheiten)]);

        var line = Assert.Single(Assert.Single(result.Costs).Lines, line => line.TenancyId is not null);
        Assert.Equal(366, line.ActiveDays);
        Assert.Equal(10_000, line.AmountCents);
    }

    [Fact]
    public void PrepaymentsAreSubtractedFromTheBalance()
    {
        var result = Calculate(
            units: [new("eg", 6200)],
            tenancies: [FullYearTenancy("mieter-eg", "eg", monthlyPrepaymentCents: 5_000)],
            costs: [new("wasser", "wasser", 120_000, DistributionKey.Einheiten)]);

        var settlement = Assert.Single(result.Tenancies);
        Assert.Equal(60_000, settlement.PrepaidCents);
        Assert.Equal(60_000, settlement.BalanceCents);
    }

    [Fact]
    public void RoundingDifferenceGoesToVacancy()
    {
        var result = Calculate(
            units: [new("eg", 1), new("og", 1), new("dg", 1)],
            tenancies: [FullYearTenancy("mieter-eg", "eg")],
            costs: [new("sonstige", "sonstige_betriebskosten", 1, DistributionKey.Flaeche)]);

        var allocation = Assert.Single(result.Costs);
        Assert.Equal(0, allocation.Lines[0].AmountCents);
        Assert.Equal(1, allocation.VacancyCents);
    }

    [Fact]
    public void TenantChangeMidYearAllocatesTheWholeUnitOverBothTenancies()
    {
        var result = Calculate(
            units: [new("eg", 6200)],
            tenancies:
            [
                new("mieter-a", "eg", "Mieter A", 1, 0, new DateOnly(2025, 1, 1), new DateOnly(2025, 6, 30)),
                new("mieter-b", "eg", "Mieter B", 1, 0, new DateOnly(2025, 7, 1)),
            ],
            costs: [new("wasser", "wasser", 36_500, DistributionKey.Flaeche)]);

        var allocation = Assert.Single(result.Costs);
        Assert.Equal(18_100, allocation.Lines[0].AmountCents);
        Assert.Equal(18_400, allocation.Lines[1].AmountCents);
        Assert.Equal(0, allocation.VacancyCents);
    }

    [Fact]
    public void TenancyStartingOnDecember31GetsOneActiveDay()
    {
        var result = Calculate(
            units: [new("eg", 6200), new("og", 11800)],
            tenancies: [new(
                "mieter-eg",
                "eg",
                "Mieter EG",
                1,
                0,
                new DateOnly(2025, 12, 31))],
            costs: [new("wasser", "wasser", 36_500, DistributionKey.Einheiten)]);

        var allocation = Assert.Single(result.Costs);
        Assert.Equal(1, allocation.Lines[0].ActiveDays);
        Assert.Equal(50, allocation.Lines[0].AmountCents);
        Assert.Equal(36_450, allocation.VacancyCents);
    }

    [Fact]
    public void FullYearVacancyIsReturnedAsOneVacancyLine()
    {
        var result = Calculate(
            units: [new("eg", 6200)],
            tenancies: [],
            costs: [new("grundsteuer", "grundsteuer", 10_000, DistributionKey.Flaeche)]);

        var allocation = Assert.Single(result.Costs);
        var vacancy = Assert.Single(allocation.Lines);
        Assert.Null(vacancy.TenancyId);
        Assert.Equal("Leerstand (Vermieter)", vacancy.Label);
        Assert.Equal(10_000, vacancy.AmountCents);
    }

    private static AllocationResult Calculate(
        int year = 2025,
        IReadOnlyList<UnitInput>? units = null,
        IReadOnlyList<TenancyInput>? tenancies = null,
        IReadOnlyList<CostItemInput>? costs = null) =>
        AllocationCalculator.Calculate(new AllocationRequest(
            year,
            units ?? [new("eg", 6200)],
            tenancies ?? [],
            costs ?? []));

    private static TenancyInput FullYearTenancy(
        string id,
        string unitId,
        int persons = 1,
        long monthlyPrepaymentCents = 0) => new(
        id,
        unitId,
        id,
        persons,
        monthlyPrepaymentCents,
        new DateOnly(2025, 1, 1));
}
