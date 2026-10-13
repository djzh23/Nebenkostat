using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace Backend.Infrastructure;

public interface ISupabaseRestClient
{
    Task<IReadOnlyList<T>> InsertAsync<T>(
        string table,
        object row,
        string accessToken,
        CancellationToken cancellationToken = default);
}

public sealed class SupabaseApiException(int statusCode, string responseBody)
    : Exception($"Supabase REST API returned HTTP {statusCode}.")
{
    public int StatusCode { get; } = statusCode;
    public string ResponseBody { get; } = responseBody;
}

public sealed class SupabaseRestClient(
    HttpClient httpClient,
    IConfiguration configuration) : ISupabaseRestClient
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly string apiKey = configuration["Supabase:ApiKey"]
        ?? Environment.GetEnvironmentVariable("SUPABASE_PUBLISHABLE_KEY")
        ?? Environment.GetEnvironmentVariable("SUPABASE_ANON_KEY")
        ?? Environment.GetEnvironmentVariable("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
        ?? Environment.GetEnvironmentVariable("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        ?? throw new InvalidOperationException(
            "Supabase ist nicht konfiguriert. Setze SUPABASE_PUBLISHABLE_KEY oder SUPABASE_ANON_KEY.");

    public async Task<IReadOnlyList<T>> InsertAsync<T>(
        string table,
        object row,
        string accessToken,
        CancellationToken cancellationToken = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, $"rest/v1/{table}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Headers.TryAddWithoutValidation("apikey", apiKey);
        request.Headers.TryAddWithoutValidation("Prefer", "return=representation");
        request.Content = new StringContent(
            JsonSerializer.Serialize(row, JsonOptions),
            Encoding.UTF8,
            "application/json");

        using var response = await httpClient.SendAsync(request, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
            throw new SupabaseApiException((int)response.StatusCode, body);

        return JsonSerializer.Deserialize<List<T>>(body, JsonOptions) ?? [];
    }
}
