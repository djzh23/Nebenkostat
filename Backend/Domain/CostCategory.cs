namespace Backend.Domain;

public sealed record CostCategoryDefinition(
    string Key,
    string Label,
    bool RequiresConsumptionData = false,
    bool RequiresDescription = false);

public static class CostCategories
{
    public static IReadOnlyList<CostCategoryDefinition> All { get; } =
    [
        new("grundsteuer", "Grundsteuer"),
        new("wasser", "Wasser/Versorgung"),
        new("entwaesserung", "Entwässerung/Abwasser"),
        new("heizung", "Heizung", RequiresConsumptionData: true),
        new("warmwasser", "Warmwasser", RequiresConsumptionData: true),
        new(
            "heizung_warmwasser_verbunden",
            "Verbundene Heizung und Warmwasseranlage",
            RequiresConsumptionData: true),
        new("aufzug", "Aufzug"),
        new("strassenreinigung", "Straßenreinigung"),
        new("muellbeseitigung", "Müllbeseitigung"),
        new("gebaeudereinigung", "Gebäudereinigung"),
        new("gartenpflege", "Gartenpflege"),
        new("beleuchtung", "Kosten der Beleuchtung"),
        new("schornsteinreinigung", "Schornsteinreinigung"),
        new("sach_und_haftpflichtversicherung", "Sach- und Haftpflichtversicherung"),
        new("hauswart", "Hauswart"),
        new(
            "gemeinschafts_antenne_verteilanlage",
            "Gemeinschafts-Antennen-/Verteilanlage"),
        new("waeschepflege", "Wäschepflege"),
        new(
            "sonstige_betriebskosten",
            "Sonstige Betriebskosten",
            RequiresDescription: true),
    ];
}
