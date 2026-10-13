using System.Security.Claims;

public interface ICurrentUser
{
    bool IsAuthenticated { get; }
    string? AccessToken { get; }
    string? UserId { get; }
    string? Email { get; }
}

public sealed class CurrentUser(IHttpContextAccessor httpContextAccessor) : ICurrentUser
{
    private ClaimsPrincipal Principal =>
        httpContextAccessor.HttpContext?.User ?? new ClaimsPrincipal(new ClaimsIdentity());

    public bool IsAuthenticated => Principal.Identity?.IsAuthenticated == true;

    public string? AccessToken
    {
        get
        {
            var authorization = httpContextAccessor.HttpContext?.Request.Headers.Authorization.ToString();
            return authorization?.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) == true
                ? authorization["Bearer ".Length..].Trim()
                : null;
        }
    }

    public string? UserId => Principal.FindFirstValue("sub");

    public string? Email => Principal.FindFirstValue("email");
}
