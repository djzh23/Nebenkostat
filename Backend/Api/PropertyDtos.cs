using System.Text.Json.Serialization;

namespace Backend.Api;

public sealed record CreatePropertyRequest(
    string? Name,
    string? Street,
    string? Zip,
    string? City);

public sealed record CreateUnitRequest(
    string? Label,
    decimal? AreaM2);

public sealed record PropertyRow(
    [property: JsonPropertyName("id")] Guid Id,
    [property: JsonPropertyName("user_id")] Guid UserId,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("street")] string? Street,
    [property: JsonPropertyName("zip")] string? Zip,
    [property: JsonPropertyName("city")] string? City,
    [property: JsonPropertyName("created_at")] DateTimeOffset CreatedAt);

public sealed record UnitRow(
    [property: JsonPropertyName("id")] Guid Id,
    [property: JsonPropertyName("property_id")] Guid PropertyId,
    [property: JsonPropertyName("user_id")] Guid UserId,
    [property: JsonPropertyName("label")] string Label,
    [property: JsonPropertyName("area_m2")] decimal AreaM2,
    [property: JsonPropertyName("created_at")] DateTimeOffset CreatedAt);
