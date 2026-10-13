using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace Backend.Infrastructure;

public sealed class SupabaseAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    ISystemClock clock,
    IHttpClientFactory httpClientFactory,
    IConfiguration configuration)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder, clock)
{
    public new const string Scheme = "Supabase";
    public const string HttpClientName = "SupabaseAuth";

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly string apiKey = configuration["Supabase:ApiKey"]
        ?? Environment.GetEnvironmentVariable("SUPABASE_PUBLISHABLE_KEY")
        ?? Environment.GetEnvironmentVariable("SUPABASE_ANON_KEY")
        ?? Environment.GetEnvironmentVariable("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
        ?? Environment.GetEnvironmentVariable("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        ?? throw new InvalidOperationException(
            "Supabase ist nicht konfiguriert. Setze SUPABASE_PUBLISHABLE_KEY oder SUPABASE_ANON_KEY.");

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var authorization = Request.Headers.Authorization.ToString();
        if (!authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            return AuthenticateResult.NoResult();

        var token = authorization["Bearer ".Length..].Trim();
        if (string.IsNullOrWhiteSpace(token))
            return AuthenticateResult.Fail("Der Bearer-Token fehlt.");

        using var request = new HttpRequestMessage(HttpMethod.Get, "auth/v1/user");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Headers.TryAddWithoutValidation("apikey", apiKey);

        try
        {
            var client = httpClientFactory.CreateClient(HttpClientName);
            using var response = await client.SendAsync(request, Context.RequestAborted);
            if (!response.IsSuccessStatusCode)
                return AuthenticateResult.Fail("Supabase hat den Bearer-Token abgelehnt.");

            var user = await response.Content.ReadFromJsonAsync<SupabaseUser>(JsonOptions, Context.RequestAborted);
            if (user is null || !Guid.TryParse(user.Id, out _))
                return AuthenticateResult.Fail("Supabase hat keinen gültigen Benutzer zurückgegeben.");

            var claims = new List<Claim>
            {
                new("sub", user.Id),
                new(ClaimTypes.NameIdentifier, user.Id),
                new(ClaimTypes.AuthenticationMethod, "supabase"),
            };
            if (!string.IsNullOrWhiteSpace(user.Email))
                claims.Add(new Claim("email", user.Email));

            var identity = new ClaimsIdentity(claims, Scheme);
            return AuthenticateResult.Success(
                new AuthenticationTicket(new ClaimsPrincipal(identity), Scheme));
        }
        catch (OperationCanceledException) when (Context.RequestAborted.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception exception)
        {
            Logger.LogError(exception, "Supabase Auth konnte den Benutzer nicht prüfen.");
            return AuthenticateResult.Fail("Supabase Auth ist nicht erreichbar.");
        }
    }

    private sealed record SupabaseUser(
        [property: JsonPropertyName("id")] string Id,
        [property: JsonPropertyName("email")] string? Email);
}
