import SectionHeader from "@/components/SectionHeader";

export default function PrivacyPage() {
  return (
    <div className="space-y-8">
      <SectionHeader
        title="Privacy Policy"
        description="Last updated: June 2026"
      />
      <div className="prose prose-invert max-w-none text-[var(--muted)]">
        <p>
          At SignalForge, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our application.
        </p>

        <h3 className="text-[var(--text)] text-lg font-semibold mt-6 mb-2">1. Information We Collect</h3>
        <p>
          We collect personal information that you provide to us, such as your name, email address, and authentication credentials. We also collect the data you explicitly import into our platform (CSV/JSON records) for processing and validation purposes.
        </p>

        <h3 className="text-[var(--text)] text-lg font-semibold mt-6 mb-2">2. How We Use Your Information</h3>
        <p>
          We use the information we collect to provide, maintain, and improve our services; to process your data imports; to authenticate users; and to manage workspace access controls.
        </p>

        <h3 className="text-[var(--text)] text-lg font-semibold mt-6 mb-2">3. Data Processing and Storage</h3>
        <p>
          Imported data is temporarily stored and processed to apply schema validations, normalizations, and auto-fixes as defined by your workspace configurations. We do not sell your personal data or your imported records to third parties.
        </p>

        <h3 className="text-[var(--text)] text-lg font-semibold mt-6 mb-2">4. Third-Party Services</h3>
        <p>
          We use trusted third-party service providers (such as authentication and database hosting providers) to operate our platform. These providers have access to your personal information only to perform specific tasks on our behalf and are obligated not to disclose or use it for any other purpose.
        </p>

        <h3 className="text-[var(--text)] text-lg font-semibold mt-6 mb-2">5. Your Rights</h3>
        <p>
          Depending on your location, you may have the right to access, correct, or delete your personal data. You can manage your account information directly within the application or by contacting us.
        </p>

        <p className="mt-8 pt-8 border-t border-[var(--border)] text-sm">
          If you have any questions about this Privacy Policy, please contact us.
        </p>
      </div>
    </div>
  );
}
