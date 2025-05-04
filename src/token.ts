import User from "./db/User";
import dbConnect from "./db/db";
import dotenv from "dotenv";
dotenv.config();

export interface UserTokens {
  accessToken: string;
  refreshToken: string;
  provider: string;
  expiresAt: number;
}

/**
 * Updates user tokens in the database
 * @param email The user's email
 * @param tokens The tokens to update
 */

export async function updateUserTokens(
  userId: string,
  email: string,
  tokens: UserTokens
): Promise<void> {
  try {
    await dbConnect();

    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          [`accounts.$[elem].accessToken`]: tokens.accessToken,
          [`accounts.$[elem].refreshToken`]: tokens.refreshToken,
          [`accounts.$[elem].expiresAt`]: tokens.expiresAt,
        },
      },
      {
        arrayFilters: [{ "elem.email": email }],
        new: true,
        lean: true,
      }
    );
  } catch (error) {
    console.log("error", error);
  }
}
/**
 * Get the stored tokens for a user
 * @param userId The ID of the user
 * @returns The stored tokens or null if not found
 */
export async function getUserTokens(
  userId: string
): Promise<UserTokens | null> {
  try {
    await dbConnect();

    const user = await User.findById(userId).select(
      "accessToken refreshToken expiresAt provider"
    );

    if (!user || !user.accessToken || !user.refreshToken) {
      return null;
    }

    return {
      accessToken: user.accessToken,
      refreshToken: user.refreshToken,
      expiresAt: user.expiresAt,
      provider: user.provider || "microsoft-entra-id", // Default if not stored
    };
  } catch (error) {
    console.error("Error getting user tokens:", error);
    return null;
  }
}

/**
 * Refreshes the access token using the refresh token
 * @param refreshToken The refresh token to use
 * @returns The new tokens or null if refresh failed
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
} | null> {
  try {
    const tokenEndpoint =
      "https://login.microsoftonline.com/common/oauth2/v2.0/token";

    const params = new URLSearchParams();
    params.append("client_id", process.env.AUTH_MICROSOFT_ENTRA_ID_ID!);
    params.append("client_secret", process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!);
    params.append("refresh_token", refreshToken);
    params.append("grant_type", "refresh_token");
    params.append(
      "scope",
      "openid email profile offline_access User.Read Mail.ReadWrite Mail.Read Mail.Send "
    );

    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      console.error("Failed to refresh token:", await response.text());
      return null;
    }

    const data = await response.json();

    // Calculate expiration time (as Unix timestamp in seconds)
    const expiresAt = Math.floor(Date.now() / 1000) + data.expires_in;

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken, // Keep old if not provided
      expiresAt: expiresAt,
    };
  } catch (error) {
    console.error("Error refreshing token:", error);
    return null;
  }
}

/**
 * Gets a valid access token, refreshing if necessary
 * @returns A valid access token or null if unable to get one
 */

export async function getValidAccessToken(
  accessToken: string,
  refreshToken: string,
  expiresAt: number,
  email: string,
  userId: string
): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  const tokenExpired = !expiresAt || expiresAt < now;

  // If token is not expired, return it
  if (!tokenExpired && accessToken) {
    return accessToken;
  }

  // Otherwise refresh the token
  if (refreshToken) {
    const newTokens = await refreshAccessToken(refreshToken);

    if (newTokens) {
      // Update the tokens in the database

      await updateUserTokens(userId, email, {
        ...newTokens,
        provider: "microsoft-entra-id",
      });

      return newTokens.accessToken;
    }
  }

  return null;
}

/**
 * Refreshes a user's token by user ID
 * @param userId The ID of the user
 * @returns The new token info or null if refresh failed
 */
export async function refreshUserToken(
  userId: string
): Promise<{ accessToken: string; expiresAt: number } | null> {
  try {
    const userTokens = await getUserTokens(userId);

    if (!userTokens?.refreshToken) {
      return null;
    }

    const newTokens = await refreshAccessToken(userTokens.refreshToken);

    if (!newTokens) {
      return null;
    }

    // Get the user's email from the database
    await dbConnect();
    const user = await User.findById(userId).select("email");

    if (!user?.email) {
      throw new Error(`User with ID ${userId} not found or missing email`);
    }

    // Update the tokens in the database
    await updateUserTokens(user.email, userId, {
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken,
      expiresAt: newTokens.expiresAt,
      provider: userTokens.provider,
    });

    return {
      accessToken: newTokens.accessToken,
      expiresAt: newTokens.expiresAt,
    };
  } catch (error) {
    console.error("Error refreshing user token:", error);
    return null;
  }
}

/**
 * Utility to mark the token as needing refresh
 */
export async function forceRefreshToken(): Promise<void> {
  console.log("Token refresh flagged for next request");
  // Implementation could be added here if needed
}
