import { PromotionTemplate } from "./types";

export const DEFAULT_TEMPLATES: Record<"newsletter" | "linkedin" | "whatsapp", PromotionTemplate[]> = {
  newsletter: [
    {
      id: "nl-event-update",
      channel: "newsletter",
      name: "Event Update",
      subject: "Important update about your upcoming Linq event",
      heading: "Your Event Schedule & Details",
      message:
        "We are excited to welcome you! Please check your attendee card for the updated session timetable, entrance guidelines, and networking activities.\n\nKeep your digital card ready on your phone for quick check-in at the venue desk.",
      imageUrl: "/card-assets/purple-abstract-card.png",
      buttonText: "Open Attendee Card",
      buttonUrl: "https://linq.avtive.com",
      theme: "default",
    },
    {
      id: "nl-announcement",
      channel: "newsletter",
      name: "Announcement",
      subject: "Exciting announcement for Linq attendees",
      heading: "New Keynote Speakers & Sessions",
      message:
        "We have just revealed our special guest speakers and interactive discussion tracks. Connect with innovators, founders, and peers who are shaping the future.\n\nView the updated agenda and connect your professional profiles ahead of time.",
      imageUrl: "/card-assets/purple-abstract-card.png",
      buttonText: "View Event Agenda",
      buttonUrl: "https://linq.avtive.com",
      theme: "professional",
    },
    {
      id: "nl-promotion",
      channel: "newsletter",
      name: "Promotion",
      subject: "Exclusive attendee privilege & perks",
      heading: "Special Offer For Registered Attendees",
      message:
        "As a registered attendee of our event, you have unlocked exclusive access to partner perks, workshops, and resource kits.\n\nMake sure your profile and social links are up to date on your digital card to get noticed during networking.",
      imageUrl: "/card-assets/purple-abstract-card.png",
      buttonText: "Claim Attendee Perks",
      buttonUrl: "https://linq.avtive.com",
      theme: "event",
    },
  ],
  linkedin: [
    {
      id: "li-event-followup",
      channel: "linkedin",
      name: "Event Follow-up",
      message:
        "Hi {{name}}, great connecting with you at the event! Wanted to follow up and stay in touch here on LinkedIn. Looking forward to keeping the conversation going.",
      caption: "Follow-up note",
      theme: "default",
    },
    {
      id: "li-thank-you",
      channel: "linkedin",
      name: "Thank You",
      message:
        "Hi {{name}}, thank you for attending our event today! Your participation made our sessions vibrant and impactful. Let's connect and collaborate on future initiatives.",
      caption: "Appreciation message",
      theme: "professional",
    },
    {
      id: "li-announcement",
      channel: "linkedin",
      name: "Announcement",
      message:
        "Hi {{name}}, we just announced our upcoming community meetup and exclusive networking tracks. We would love to see you there! Check out the details on your Linq card.",
      caption: "Community announcement",
      theme: "event",
    },
  ],
  whatsapp: [
    {
      id: "wa-event-reminder",
      channel: "whatsapp",
      name: "Event Reminder",
      message:
        "Hello {{name}}! 👋 Just a quick reminder that our event starts tomorrow. Make sure to have your Linq Attendee Card ready on your phone for seamless check-in at the entrance.",
      imageUrl: "",
      caption: "Reminder",
      theme: "default",
    },
    {
      id: "wa-announcement",
      channel: "whatsapp",
      name: "Announcement",
      message:
        "Hi {{name}}! 📢 We have just published the venue schedule and speaker lineup. Check it out now and get ready for an amazing networking experience.",
      imageUrl: "",
      caption: "Venue announcement",
      theme: "professional",
    },
    {
      id: "wa-promotion",
      channel: "whatsapp",
      name: "Promotion",
      message:
        "Hi {{name}}! 🎁 Special perk for our attendees: get early access to our partner benefits and post-event resources today through your Linq card.",
      imageUrl: "",
      caption: "Special perk",
      theme: "event",
    },
  ],
};
