"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.forceRefreshToken = exports.refreshUserToken = exports.getValidAccessToken = exports.refreshAccessToken = exports.getUserTokens = exports.updateUserTokens = void 0;
const User_1 = __importDefault(require("./db/User"));
const db_1 = __importDefault(require("./db/db"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
/**
 * Updates user tokens in the database
 * @param email The user's email
 * @param tokens The tokens to update
 */
function updateUserTokens(userId, email, tokens) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield (0, db_1.default)();
            const user = yield User_1.default.findByIdAndUpdate(userId, {
                $set: {
                    [`accounts.$[elem].accessToken`]: tokens.accessToken,
                    [`accounts.$[elem].refreshToken`]: tokens.refreshToken,
                    [`accounts.$[elem].expiresAt`]: tokens.expiresAt,
                },
            }, {
                arrayFilters: [{ "elem.email": email }],
                new: true,
                lean: true,
            });
        }
        catch (error) {
            console.log("error", error);
        }
    });
}
exports.updateUserTokens = updateUserTokens;
/**
 * Get the stored tokens for a user
 * @param userId The ID of the user
 * @returns The stored tokens or null if not found
 */
function getUserTokens(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield (0, db_1.default)();
            const user = yield User_1.default.findById(userId).select("accessToken refreshToken expiresAt provider");
            if (!user || !user.accessToken || !user.refreshToken) {
                return null;
            }
            return {
                accessToken: user.accessToken,
                refreshToken: user.refreshToken,
                expiresAt: user.expiresAt,
                provider: user.provider || "microsoft-entra-id", // Default if not stored
            };
        }
        catch (error) {
            console.error("Error getting user tokens:", error);
            return null;
        }
    });
}
exports.getUserTokens = getUserTokens;
/**
 * Refreshes the access token using the refresh token
 * @param refreshToken The refresh token to use
 * @returns The new tokens or null if refresh failed
 */
function refreshAccessToken(refreshToken) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const tokenEndpoint = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
            const params = new URLSearchParams();
            params.append("client_id", process.env.AUTH_MICROSOFT_ENTRA_ID_ID);
            params.append("client_secret", process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET);
            params.append("refresh_token", refreshToken);
            params.append("grant_type", "refresh_token");
            params.append("scope", "openid email profile offline_access User.Read Mail.ReadWrite Mail.Read Mail.Send ");
            const response = yield fetch(tokenEndpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: params.toString(),
            });
            if (!response.ok) {
                console.error("Failed to refresh token:", yield response.text());
                return null;
            }
            const data = yield response.json();
            // Calculate expiration time (as Unix timestamp in seconds)
            const expiresAt = Math.floor(Date.now() / 1000) + data.expires_in;
            return {
                accessToken: data.access_token,
                refreshToken: data.refresh_token || refreshToken, // Keep old if not provided
                expiresAt: expiresAt,
            };
        }
        catch (error) {
            console.error("Error refreshing token:", error);
            return null;
        }
    });
}
exports.refreshAccessToken = refreshAccessToken;
/**
 * Gets a valid access token, refreshing if necessary
 * @returns A valid access token or null if unable to get one
 */
function getValidAccessToken(accessToken, refreshToken, expiresAt, email, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        const now = Math.floor(Date.now() / 1000);
        const tokenExpired = !expiresAt || expiresAt < now;
        // If token is not expired, return it
        if (!tokenExpired && accessToken) {
            return accessToken;
        }
        // Otherwise refresh the token
        if (refreshToken) {
            const newTokens = yield refreshAccessToken(refreshToken);
            if (newTokens) {
                // Update the tokens in the database
                yield updateUserTokens(userId, email, Object.assign(Object.assign({}, newTokens), { provider: "microsoft-entra-id" }));
                return newTokens.accessToken;
            }
        }
        return null;
    });
}
exports.getValidAccessToken = getValidAccessToken;
/**
 * Refreshes a user's token by user ID
 * @param userId The ID of the user
 * @returns The new token info or null if refresh failed
 */
function refreshUserToken(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const userTokens = yield getUserTokens(userId);
            if (!(userTokens === null || userTokens === void 0 ? void 0 : userTokens.refreshToken)) {
                return null;
            }
            const newTokens = yield refreshAccessToken(userTokens.refreshToken);
            if (!newTokens) {
                return null;
            }
            // Get the user's email from the database
            yield (0, db_1.default)();
            const user = yield User_1.default.findById(userId).select("email");
            if (!(user === null || user === void 0 ? void 0 : user.email)) {
                throw new Error(`User with ID ${userId} not found or missing email`);
            }
            // Update the tokens in the database
            yield updateUserTokens(user.email, userId, {
                accessToken: newTokens.accessToken,
                refreshToken: newTokens.refreshToken,
                expiresAt: newTokens.expiresAt,
                provider: userTokens.provider,
            });
            return {
                accessToken: newTokens.accessToken,
                expiresAt: newTokens.expiresAt,
            };
        }
        catch (error) {
            console.error("Error refreshing user token:", error);
            return null;
        }
    });
}
exports.refreshUserToken = refreshUserToken;
/**
 * Utility to mark the token as needing refresh
 */
function forceRefreshToken() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Token refresh flagged for next request");
        // Implementation could be added here if needed
    });
}
exports.forceRefreshToken = forceRefreshToken;
