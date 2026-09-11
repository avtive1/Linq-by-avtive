import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  generateLinkedInAuthUrl,
  createLinkedInStateToken,
  verifyLinkedInStateToken,
  sealLinkedInSession,
  unsealLinkedInSession,
  initializeLinkedInImageUpload,
  uploadImageBinaryToLinkedIn,
  createLinkedInImagePost,
  getLinkedInOAuthConfig,
} from "@/lib/services/linkedin.service";
import {
  buildCardLinkedInSharePost,
  buildPublicCardShareLandingUrl,
} from "@/lib/share/linkedin-card-share";

describe("LinkedIn Attendee Card Sharing Service", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      LINKEDIN_CLIENT_ID: "test_client_id_123",
      LINKEDIN_CLIENT_SECRET: "test_client_secret_xyz",
      LINKEDIN_REDIRECT_URI: "https://linq.avtive.app/api/share/linkedin/callback",
      LINKEDIN_API_VERSION: "202401",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("Configuration & OAuth URL", () => {
    it("reads valid configuration from environment", () => {
      const config = getLinkedInOAuthConfig();
      expect(config.clientId).toBe("test_client_id_123");
      expect(config.clientSecret).toBe("test_client_secret_xyz");
      expect(config.redirectUri).toBe("https://linq.avtive.app/api/share/linkedin/callback");
      expect(config.apiVersion).toBe("202401");
    });

    it("throws a clear error when client credentials are missing", () => {
      delete process.env.LINKEDIN_CLIENT_ID;
      expect(() => getLinkedInOAuthConfig()).toThrow(/LinkedIn credentials not configured/i);
    });

    it("generates correct authorization URL with required member scopes", () => {
      const config = getLinkedInOAuthConfig();
      const state = "secure_state_12345";
      const urlString = generateLinkedInAuthUrl(state, config);
      const url = new URL(urlString);

      expect(url.origin).toBe("https://www.linkedin.com");
      expect(url.pathname).toBe("/oauth/v2/authorization");
      expect(url.searchParams.get("response_type")).toBe("code");
      expect(url.searchParams.get("client_id")).toBe("test_client_id_123");
      expect(url.searchParams.get("redirect_uri")).toBe(
        "https://linq.avtive.app/api/share/linkedin/callback"
      );
      expect(url.searchParams.get("state")).toBe(state);
      expect(url.searchParams.get("scope")).toContain("w_member_social");
      expect(url.searchParams.get("scope")).toContain("openid");
      expect(url.searchParams.get("scope")).toContain("profile");
    });
  });

  describe("CSRF State Token", () => {
    it("creates and verifies a signed state token", async () => {
      const payload = {
        cardId: "00000000-0000-0000-0000-000000000001",
        shareToken: "token_abc_123",
        isPopup: true,
        nonce: "random_nonce_999",
        timestamp: Date.now(),
      };

      const token = await createLinkedInStateToken(payload);
      expect(typeof token).toBe("string");
      expect(token.length).toBeGreaterThan(20);

      const verified = await verifyLinkedInStateToken(token);
      expect(verified).not.toBeNull();
      expect(verified?.cardId).toBe(payload.cardId);
      expect(verified?.shareToken).toBe(payload.shareToken);
      expect(verified?.isPopup).toBe(true);
      expect(verified?.nonce).toBe(payload.nonce);
    });

    it("rejects a tampered state token", async () => {
      const payload = {
        cardId: "00000000-0000-0000-0000-000000000001",
        nonce: "test_nonce",
        timestamp: Date.now(),
      };
      const token = await createLinkedInStateToken(payload);
      const tampered = token.slice(0, -5) + "abcde";
      const result = await verifyLinkedInStateToken(tampered);
      expect(result).toBeNull();
    });
  });

  describe("Encrypted Session Storage", () => {
    it("seals and unseals session data with member info and token", async () => {
      const sessionData = {
        accessToken: "AQV_test_access_token_super_secret",
        expiresAt: Date.now() + 3600 * 1000,
        memberSub: "abc123sub",
        memberName: "Alex Rivera",
        memberEmail: "alex@example.com",
        memberPicture: "https://media.licdn.com/dms/image/profile.jpg",
      };

      const sealed = await sealLinkedInSession(sessionData);
      expect(typeof sealed).toBe("string");

      const unsealed = await unsealLinkedInSession(sealed);
      expect(unsealed).not.toBeNull();
      expect(unsealed?.accessToken).toBe(sessionData.accessToken);
      expect(unsealed?.memberSub).toBe("abc123sub");
      expect(unsealed?.memberName).toBe("Alex Rivera");
      expect(unsealed?.memberEmail).toBe("alex@example.com");
      expect(unsealed?.memberPicture).toBe(sessionData.memberPicture);
    });

    it("rejects an expired session", async () => {
      const expiredSession = {
        accessToken: "expired_token",
        expiresAt: Date.now() - 5000, // already expired
        memberSub: "abc123sub",
        memberName: "Alex",
      };

      const sealed = await sealLinkedInSession(expiredSession);
      const unsealed = await unsealLinkedInSession(sealed);
      expect(unsealed).toBeNull();
    });
  });

  describe("LinkedIn Images API (Upload)", () => {
    it("initializes image upload with member author URN and versioned headers", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          value: {
            uploadUrl: "https://www.linkedin.com/dms-uploads/upload-target-url",
            uploadUrlExpiresAt: Date.now() + 300000,
            image: "urn:li:image:C4D22AQF_test_image_urn",
          },
        }),
      });
      global.fetch = mockFetch;

      const result = await initializeLinkedInImageUpload("token_123", "person_456", "202401");

      expect(result.uploadUrl).toBe("https://www.linkedin.com/dms-uploads/upload-target-url");
      expect(result.imageUrn).toBe("urn:li:image:C4D22AQF_test_image_urn");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.linkedin.com/rest/images?action=initializeUpload",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer token_123",
            "LinkedIn-Version": "202401",
            "X-Restli-Protocol-Version": "2.0.0",
          }),
          body: JSON.stringify({
            initializeUploadRequest: {
              owner: "urn:li:person:person_456",
            },
          }),
        })
      );
    });

    it("uploads binary image buffer via PUT to upload URL", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
      });
      global.fetch = mockFetch;

      const dummyBuffer = Buffer.from("fake_image_bytes");
      await uploadImageBinaryToLinkedIn(
        "https://www.linkedin.com/dms-uploads/upload-target-url",
        dummyBuffer,
        "image/png"
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "https://www.linkedin.com/dms-uploads/upload-target-url",
        expect.objectContaining({
          method: "PUT",
          headers: {
            "Content-Type": "image/png",
            "Content-Length": String(dummyBuffer.length),
          },
          body: dummyBuffer,
        })
      );
    });
  });

  describe("LinkedIn Posts API (Image Post Creation)", () => {
    it("creates a post attaching the image URN and commentary", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        headers: new Headers({
          "x-restli-id": "urn:li:share:7123456789012345678",
        }),
        text: async () => JSON.stringify({ id: "urn:li:share:7123456789012345678" }),
      });
      global.fetch = mockFetch;

      const result = await createLinkedInImagePost({
        accessToken: "token_123",
        memberSub: "person_456",
        imageUrn: "urn:li:image:C4D22AQF_test_image_urn",
        commentary: "Excited to attend Future Con 2026!\n\nhttps://linq.avtive.app/cards/123/share",
        title: "Alex Rivera · Future Con 2026 Badge",
        apiVersion: "202401",
      });

      expect(result.postUrn).toBe("urn:li:share:7123456789012345678");
      expect(result.postUrl).toBe(
        "https://www.linkedin.com/feed/update/urn:li:share:7123456789012345678"
      );

      const postCallBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(postCallBody.author).toBe("urn:li:person:person_456");
      expect(postCallBody.content.media.id).toBe("urn:li:image:C4D22AQF_test_image_urn");
      expect(postCallBody.content.media.altText).toBe("Attendee card");
      expect(postCallBody.content.media.title).toBe("Alex Rivera · Future Con 2026 Badge");
      expect(postCallBody.commentary).toContain("https://linq.avtive.app/cards/123/share");
      expect(postCallBody.visibility).toBe("PUBLIC");
      expect(postCallBody.distribution.feedDistribution).toBe("MAIN_FEED");
      expect(postCallBody.lifecycleState).toBe("PUBLISHED");
      expect(postCallBody.isReshareDisabledByAuthor).toBe(false);
    });
  });

  describe("Commentary & Card Share Link Helper", () => {
    it("builds formatted post commentary containing attendee details and share URL", () => {
      const shareUrl = buildPublicCardShareLandingUrl("card-uuid-123", "https://linq.avtive.app");
      expect(shareUrl).toBe("https://linq.avtive.app/cards/card-uuid-123/share");

      const postText = buildCardLinkedInSharePost({
        name: "Samantha Wright",
        eventName: "DevFest 2026",
        role: "Senior Engineer",
        company: "TechCorp",
        shareUrl,
        cardRole: "guest",
      });

      expect(postText).toContain("Honored to be a guest at DevFest 2026.");
      expect(postText).toContain("Samantha Wright · Senior Engineer at TechCorp");
      expect(postText).toContain("https://linq.avtive.app/cards/card-uuid-123/share");
    });
  });
});
