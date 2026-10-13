using Backend.Api;
using Backend.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

var supabaseUrl = builder.Configuration["Supabase:Url"]
    ?? Environment.GetEnvironmentVariable("SUPABASE_URL")
    ?? Environment.GetEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL");
var supabaseApiKey = builder.Configuration["Supabase:ApiKey"]
    ?? Environment.GetEnvironmentVariable("SUPABASE_PUBLISHABLE_KEY")
    ?? Environment.GetEnvironmentVariable("SUPABASE_ANON_KEY")
    ?? Environment.GetEnvironmentVariable("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
    ?? Environment.GetEnvironmentVariable("NEXT_PUBLIC_SUPABASE_ANON_KEY");

if (string.IsNullOrWhiteSpace(supabaseUrl))
{
    throw new InvalidOperationException(
        "Supabase ist nicht konfiguriert. Setze SUPABASE_URL oder NEXT_PUBLIC_SUPABASE_URL.");
}

if (string.IsNullOrWhiteSpace(supabaseApiKey))
{
    throw new InvalidOperationException(
        "Supabase ist nicht konfiguriert. Setze SUPABASE_PUBLISHABLE_KEY oder SUPABASE_ANON_KEY.");
}

builder.Services
    .AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = SupabaseAuthenticationHandler.Scheme;
        options.DefaultChallengeScheme = SupabaseAuthenticationHandler.Scheme;
    })
    .AddScheme<Microsoft.AspNetCore.Authentication.AuthenticationSchemeOptions, SupabaseAuthenticationHandler>(
        SupabaseAuthenticationHandler.Scheme,
        _ => { });
builder.Services.AddAuthorization();
builder.Services.AddHttpContextAccessor();
builder.Services.AddHttpClient(SupabaseAuthenticationHandler.HttpClientName, client =>
{
    client.BaseAddress = new Uri($"{supabaseUrl.TrimEnd('/')}/");
});
builder.Services.AddScoped<ICurrentUser, CurrentUser>();
builder.Services.AddHttpClient<ISupabaseRestClient, SupabaseRestClient>(client =>
{
    client.BaseAddress = new Uri($"{supabaseUrl.TrimEnd('/')}/");
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "ok" }))
    .AllowAnonymous();

app.MapGet("/api/me", (ICurrentUser currentUser) =>
{
    return Results.Ok(new { userId = currentUser.UserId, email = currentUser.Email });
})
.RequireAuthorization();

app.MapPost("/api/properties", async (
    CreatePropertyRequest request,
    ICurrentUser currentUser,
    ISupabaseRestClient supabase,
    ILogger<Program> logger,
    CancellationToken cancellationToken) =>
{
    if (!TryGetUserContext(currentUser, out var userId, out var accessToken))
        return Results.Unauthorized();

    var name = request.Name?.Trim();
    if (string.IsNullOrWhiteSpace(name) || name.Length > 120)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["name"] = ["Bitte einen Namen mit 1 bis 120 Zeichen angeben."],
        });
    }

    if (request.Zip is { Length: > 20 })
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["zip"] = ["Die Postleitzahl darf höchstens 20 Zeichen enthalten."],
        });
    }

    var row = new Dictionary<string, object?>
    {
        ["user_id"] = userId,
        ["name"] = name,
        ["street"] = CleanOptional(request.Street),
        ["zip"] = CleanOptional(request.Zip),
        ["city"] = CleanOptional(request.City),
    };

    try
    {
        var created = await supabase.InsertAsync<PropertyRow>("properties", row, accessToken, cancellationToken);
        var property = created.FirstOrDefault();
        return property is null
            ? Results.Problem("Supabase hat kein angelegtes Objekt zurückgegeben.", statusCode: StatusCodes.Status502BadGateway)
            : Results.Created($"/api/properties/{property.Id}", property);
    }
    catch (Exception exception) when (exception is SupabaseApiException or HttpRequestException)
    {
        logger.LogError(exception, "Objekt konnte in Supabase nicht angelegt werden.");
        return Results.Problem("Das Objekt konnte nicht gespeichert werden.", statusCode: StatusCodes.Status502BadGateway);
    }
})
.RequireAuthorization();

app.MapPost("/api/properties/{propertyId:guid}/units", async (
    Guid propertyId,
    CreateUnitRequest request,
    ICurrentUser currentUser,
    ISupabaseRestClient supabase,
    ILogger<Program> logger,
    CancellationToken cancellationToken) =>
{
    if (!TryGetUserContext(currentUser, out var userId, out var accessToken))
        return Results.Unauthorized();

    var label = request.Label?.Trim();
    if (string.IsNullOrWhiteSpace(label) || label.Length > 120)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["label"] = ["Bitte eine Bezeichnung mit 1 bis 120 Zeichen angeben."],
        });
    }

    if (request.AreaM2 is not > 0 or > 1_000_000)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["areaM2"] = ["Die Wohnfläche muss größer als 0 und plausibel sein."],
        });
    }

    var row = new Dictionary<string, object?>
    {
        ["property_id"] = propertyId,
        ["user_id"] = userId,
        ["label"] = label,
        ["area_m2"] = request.AreaM2.Value,
    };

    try
    {
        var created = await supabase.InsertAsync<UnitRow>("units", row, accessToken, cancellationToken);
        var unit = created.FirstOrDefault();
        return unit is null
            ? Results.Problem("Supabase hat keine angelegte Einheit zurückgegeben.", statusCode: StatusCodes.Status502BadGateway)
            : Results.Created($"/api/properties/{propertyId}/units/{unit.Id}", unit);
    }
    catch (Exception exception) when (exception is SupabaseApiException or HttpRequestException)
    {
        logger.LogError(exception, "Einheit konnte in Supabase nicht angelegt werden.");
        return Results.Problem("Die Einheit konnte nicht gespeichert werden.", statusCode: StatusCodes.Status502BadGateway);
    }
})
.RequireAuthorization();

var summaries = new[]
{
    "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
};

app.MapGet("/weatherforecast", () =>
{
    var forecast = Enumerable.Range(1, 5).Select(index =>
        new WeatherForecast(
            DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
            Random.Shared.Next(-20, 55),
            summaries[Random.Shared.Next(summaries.Length)]))
        .ToArray();
    return forecast;
})
.WithName("GetWeatherForecast")
.WithOpenApi();

app.Run();

static bool TryGetUserContext(ICurrentUser currentUser, out string userId, out string accessToken)
{
    userId = currentUser.UserId ?? string.Empty;
    accessToken = currentUser.AccessToken ?? string.Empty;
    return Guid.TryParse(userId, out _) && !string.IsNullOrWhiteSpace(accessToken);
}

static string? CleanOptional(string? value) =>
    string.IsNullOrWhiteSpace(value) ? null : value.Trim();

record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}
