/**
 * legal.ts — the privacy policy and terms, transcribed VERBATIM from the live site.
 *
 * ============================================================================
 * READ THIS BEFORE TOUCHING THE TEXT BELOW.
 *
 * This is legal copy. It was copied word-for-word from the pages currently live at
 * apexgetsitdone.com on 2026-07-29, and it must not be paraphrased, "improved", summarised,
 * regenerated, or tidied up — not by a person and emphatically not by a model. If it needs to
 * change, that is a lawyer's job, and the change belongs in this file as a new transcription.
 *
 * WHY THESE PAGES EXIST HERE AT ALL: the live versions are on the very domain this project
 * replaces, so at DNS cutover they 404. Two things break at once — the footer links, and A2P
 * 10DLC registration, which carriers gate on a reachable privacy policy that names SMS.
 * ============================================================================
 *
 * ⚠ THE TRANSCRIPTION SURFACED FOUR PROBLEMS. They are reproduced faithfully below rather
 * than silently corrected, because correcting them is a legal decision, not an editorial one.
 * All four need an answer before launch — see `legalReview` and docs/launch-checklist.md.
 *
 *   1. SCOPE. The privacy policy says it "applies to apexcoatinglbk.com" and covers
 *      "Apex Concrete Coating, and Apex Designer Pools". This site is apexgetsitdone.com and
 *      has FOUR verticals. Design & Renovation and Pool Service are not covered by their own
 *      privacy policy, and the named domain is not the site the policy is served from.
 *   2. CONTACT DETAILS DISAGREE with the rest of the site. The policy gives
 *      travis@apexcoatingtx.com and 1 (806) 928-8200; the site uses travis@apexgetsitdone.com
 *      and 806.605.0502. A third email domain appears in the terms.
 *   3. THE TERMS COVER TWO VERTICALS. The SMS program is described as being for
 *      "Concrete Coating & Designer Pools services" — but the quote form captures consent for
 *      all four, and the consent line names whichever vertical the visitor picked.
 *   4. STALE. The policy is "Effective as of April 20, 2022" and predates the four-vertical
 *      structure entirely.
 */

export interface LegalBlock {
  readonly type: 'p' | 'ul';
  readonly text?: string;
  readonly items?: readonly string[];
  /**
   * Optionally turn one phrase inside `text` into a link, WITHOUT altering the wording.
   * The phrase must appear in `text` verbatim; the component only wraps it in an anchor.
   * This is how a cross-reference stays a working link without editing legal copy.
   */
  readonly linkPhrase?: string;
  readonly linkHref?: string;
}

export interface LegalSection {
  readonly heading?: string;
  readonly blocks: readonly LegalBlock[];
}

export interface LegalDocument {
  readonly title: string;
  /** Shown to the visitor. Verbatim from the source. */
  readonly effective: string;
  /** Where this was transcribed from, so the next person can diff it. */
  readonly sourceUrl: string;
  readonly transcribedOn: string;
  /**
   * Has a human with authority signed off on this text for use on THIS site?
   *
   * False until someone answers the four problems in the header. `npm run preflight` reports
   * every unreviewed document, so a production build cannot quietly ship a privacy policy
   * that names the wrong domain and omits half the business.
   */
  readonly reviewed: boolean;
  readonly sections: readonly LegalSection[];
}

/* ------------------------------------------------------------------ privacy policy */

export const privacyPolicy: LegalDocument = {
  title: 'Privacy Policy',
  effective: 'Effective as of April 20, 2022',
  sourceUrl: 'https://apexgetsitdone.com/privacy-policy-apex-designer-pools/',
  transcribedOn: '2026-07-29',
  reviewed: false,
  sections: [
    {
      blocks: [
        {
          type: 'p',
          text: 'Protecting your private information is our priority. This Statement of Privacy applies to apexcoatinglbk.com, and Bouffard Enterprises, LLC and governs data collection and usage. For the purposes of this Privacy Policy, unless otherwise noted, all references to Bouffard Enterprises, LLC include apexcoatinglbk.com, Apex Concrete Coating, and Apex Designer Pools. The Apex Designer Pools website is a Concrete Coating and Designer Pools site. By using the Apex Concrete Coating website, you consent to the data practices described in this statement.',
        },
      ],
    },
    {
      heading: 'Collection of your Personal Information',
      blocks: [
        {
          type: 'p',
          text: 'In order to better provide you with products and services offered, Apex Designer Pools may collect personally identifiable information, such as your:',
        },
        { type: 'ul', items: ['First and Last Name', 'E-mail Address', 'Phone Number'] },
        {
          type: 'p',
          text: 'We do not collect any personal information about you unless you voluntarily provide it to us. However, you may be required to provide certain personal information to us when you elect to use certain products or services. These may include: (a) registering for an account; (b) entering a sweepstakes or contest sponsored by us or one of our partners; (c) signing up for special offers from selected third parties; (d) sending us an email message; (e) submitting your credit card or other payment information when ordering and purchasing products and services. To wit, we will use your information for, but not limited to, communicating with you in relation to services and/or products you have requested from us. We also may gather additional personal or non-personal information in the future.',
        },
      ],
    },
    {
      heading: 'Use of your Personal Information',
      blocks: [
        {
          type: 'p',
          text: 'Apex Concrete Coating collects and uses your personal information to operate and deliver the services you have requested.',
        },
        {
          type: 'p',
          text: 'Apex Concrete Coating may also use your personally identifiable information to inform you of other products or services available from Apex Concrete Coating and its affiliates.',
        },
      ],
    },
    {
      heading: 'Sharing Information with Third Parties',
      blocks: [
        {
          type: 'p',
          text: 'Apex Concrete Coating does not sell, rent, or lease its customer lists to third parties.',
        },
        {
          type: 'p',
          text: 'Apex Concrete Coating may share data with trusted partners to help perform statistical analysis, send you email or postal mail, provide customer support, or arrange for deliveries. All such third parties are prohibited from using your personal information except to provide these services to Apex Concrete Coating, and they are required to maintain the confidentiality of your information.',
        },
        {
          type: 'p',
          text: 'Apex Concrete Coating may disclose your personal information, without notice, if required to do so by law or in the good faith belief that such action is necessary to: (a) conform to the edicts of the law or comply with legal process served on Apex Concrete Coating or the site; (b) protect and defend the rights or property of Apex Concrete Coating; and/or (c) act under exigent circumstances to protect the personal safety of users of Apex Concrete Coating, or the public.',
        },
      ],
    },
    {
      heading: 'Automatically Collected Information',
      blocks: [
        {
          type: 'p',
          text: 'Information about your computer hardware and software may be automatically collected by Apex Concrete Coating. This information can include: your IP address, browser type, domain names, access times, and referring website addresses. This information is used for the operation of the service, to maintain the quality of the service, and to provide general statistics regarding the use of the Apex Concrete Coating website.',
        },
      ],
    },
    {
      heading: 'Security of your Personal Information',
      blocks: [
        {
          type: 'p',
          text: 'Apex Concrete Coating secures your personal information from unauthorized access, use, or disclosure. Apex Concrete Coating uses the following methods for this purpose:',
        },
        { type: 'ul', items: ['SSL Protocol'] },
        {
          type: 'p',
          text: 'When personal information (such as a credit card number) is transmitted to other websites, it is protected through the use of encryption, such as the Secure Sockets Layer (SSL) protocol.',
        },
        {
          type: 'p',
          text: 'We strive to take appropriate security measures to protect against unauthorized access to or alteration of your personal information. Unfortunately, no data transmission over the Internet or any wireless network can be guaranteed to be 100% secure. As a result, while we strive to protect your personal information, you acknowledge that: (a) there are security and privacy limitations inherent to the Internet which are beyond our control; and (b) security, integrity, and privacy of any and all information and data exchanged between you and us through this Site cannot be guaranteed.',
        },
      ],
    },
    {
      heading: 'Right to Deletion',
      blocks: [
        {
          type: 'p',
          text: 'Subject to certain exceptions set out below, on receipt of a verifiable request from you, we will:',
        },
        {
          type: 'ul',
          items: [
            'Delete your personal information from our records; and',
            'Direct any service providers to delete your personal information from their records',
          ],
        },
        {
          type: 'p',
          text: 'Please note that we may not be able to comply with requests to delete your personal information if it is necessary to:',
        },
        {
          type: 'ul',
          items: [
            'Complete the transaction for which the personal information was collected, fulfill the terms of a written warranty or product recall conducted in accordance with federal law, provide a good or service requested by you, or reasonably anticipated within the context of our ongoing business relationship with you, or otherwise perform a contract between you and us;',
            'Detect security incidents, protect against malicious, deceptive, fraudulent, or illegal activity; or prosecute those responsible for that activity;',
            'Debug to identify and repair errors that impair existing intended functionality;',
            'Exercise free speech, ensure the right of another consumer to exercise his or her right of free speech, or exercise another right provided for by law;',
            'Comply with the California Electronic Communications Privacy Act;',
            'Engage in public or peer-reviewed scientific, historical, or statistical research in the public interest that adheres to all other applicable ethics and privacy laws, when our deletion of the information is likely to render impossible or seriously impair the achievement of such research, provided we have obtained your informed consent;',
            'Enable solely internal uses that are reasonably aligned with your expectations based on your relationship with us;',
            'Comply with an existing legal obligation; or',
            'Otherwise use your personal information, internally, in a lawful manner that is compatible with the context in which you provided the information.',
          ],
        },
      ],
    },
    {
      heading: 'Children Under Thirteen',
      blocks: [
        {
          type: 'p',
          text: 'Apex Concrete Coating does not knowingly collect personally identifiable information from children under the age of thirteen. If you are under the age of thirteen, you must ask your parent or guardian for permission to use this website.',
        },
      ],
    },
    {
      heading: 'E-mail Communications',
      blocks: [
        {
          type: 'p',
          text: 'From time to time, Apex Concrete Coating may contact you via email for the purpose of providing announcements, promotional offers, alerts, confirmations, surveys, and/or other general communication. In order to improve our Services, we may receive a notification when you open an email from Apex Concrete Coating or click on a link therein.',
        },
        {
          type: 'p',
          text: 'If you would like to stop receiving marketing or promotional communications via email from Apex Concrete Coating, you may opt out of such communications by Clicking the “Unsubscribe” link in our emails.',
        },
      ],
    },
    {
      heading: 'Changes to this Statement',
      blocks: [
        {
          type: 'p',
          text: 'Apex Concrete Coating reserves the right to change this Privacy Policy from time to time. We will notify you about significant changes in the way we treat personal information by sending a notice to the primary email address specified in your account, by placing a prominent notice on our website, and/or by updating any privacy information. Your continued use of the website and/or Services available after such modifications will constitute your: (a) acknowledgment of the modified Privacy Policy; and (b) agreement to abide and be bound by that Policy.',
        },
      ],
    },
    {
      heading: 'Contact Information',
      blocks: [
        {
          type: 'p',
          text: 'Apex Concrete Coating welcomes your questions or comments regarding this Statement of Privacy. If you believe that Apex Concrete Coating has not adhered to this Statement, please contact Apex Concrete Coating at:',
        },
        {
          type: 'p',
          text: 'Bouffard Enterprises, LLC\n4617 94th Street, Lubbock, TX 79424\nEmail Address: travis@apexcoatingtx.com\nTelephone Number: 1 (806) 928-8200',
        },
      ],
    },
  ],
};

/* --------------------------------------------------------------------------- terms */

export const termsAndConditions: LegalDocument = {
  title: 'Terms and Conditions',
  effective: '',
  sourceUrl: 'https://apexgetsitdone.com/terms-and-conditions/',
  transcribedOn: '2026-07-29',
  reviewed: false,
  sections: [
    {
      blocks: [
        { type: 'p', text: 'Bouffard Enterprises, LLC' },
        {
          type: 'p',
          text: 'Our program offers appointment reminders and confirmation texts for our Concrete Coating & Designer Pools services. Users can expect to receive messages regarding upcoming appointments, confirmations, and important updates related to our services.',
        },
        {
          type: 'p',
          text: 'You can cancel the SMS service at any time. Simply text “STOP” to the shortcode. Upon sending “STOP,” we will confirm your unsubscribe status via SMS. Following this confirmation, you will no longer receive SMS messages from us. To rejoin, sign up as you did initially, and we will resume sending SMS messages to you.',
        },
        {
          type: 'p',
          text: 'If you experience issues with the messaging program, reply with the keyword HELP for more assistance, or reach out directly to travis@apexcoatingtx.com.',
        },
        { type: 'p', text: 'Carriers are not liable for delayed or undelivered messages.' },
        {
          type: 'p',
          text: 'As always, message and data rates may apply for messages sent to you from us and to us from you. You will receive appointment reminders and confirmation texts. For questions about your text plan or data plan, contact your wireless provider.',
        },
        /*
         * THE ONE DEVIATION FROM VERBATIM, declared rather than made silently.
         *
         * The source sentence ends with an absolute URL:
         *   "...please refer to our privacy policy: https://apexgetsitdone.com/privacy-policy/."
         *
         * That URL is not the policy's real address — it 301s to
         * /privacy-policy-apex-designer-pools/ — and both die at cutover. Reproducing a link
         * that will be broken on the day it ships is worse than pointing at the live one, so
         * the trailing URL is dropped and the component links the phrase "our privacy policy"
         * to /privacy instead. The wording is otherwise untouched.
         *
         * If the reviewing lawyer wants the absolute URL restored, restore it here.
         */
        {
          type: 'p',
          text: 'For privacy-related inquiries, please refer to our privacy policy.',
          linkPhrase: 'our privacy policy',
          linkHref: '/privacy',
        },
      ],
    },
  ],
};

/** Every legal document, for the routes and for the preflight review check. */
export const LEGAL_DOCUMENTS = { privacy: privacyPolicy, terms: termsAndConditions } as const;

/**
 * Documents not yet signed off for use on this site. Surfaced by `npm run preflight`.
 * See the four problems listed at the top of this file.
 */
export const legalReview = {
  outstanding: Object.entries(LEGAL_DOCUMENTS)
    .filter(([, doc]) => !doc.reviewed)
    .map(([slug]) => slug),
} as const;
