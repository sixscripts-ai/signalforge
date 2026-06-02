import SectionHeader from "@/components/SectionHeader";

export default function TermsPage() {
  return (
    <div className="space-y-8">
      <SectionHeader
        title="Terms of Service"
        description="Last updated: June 2026"
      />
      <div className="prose prose-invert max-w-none text-[var(--muted)]">
        <p>
          Welcome to SignalForge. By accessing or using our platform, you agree to be bound by these Terms of Service.
        </p>

        <h3 className="text-[var(--text)] text-lg font-semibold mt-6 mb-2">1. Use of Service</h3>
        <p>
          SignalForge provides a data ingestion and validation operations console. You are responsible for the data you import into our systems and must ensure you have the rights to process such data.
        </p>

        <h3 className="text-[var(--text)] text-lg font-semibold mt-6 mb-2">2. Accounts and Workspaces</h3>
        <p>
          To use certain features, you must register for an account. You are responsible for safeguarding your account credentials and for any activities or actions under your account. Workspace administrators are responsible for managing access for their team members.
        </p>

        <h3 className="text-[var(--text)] text-lg font-semibold mt-6 mb-2">3. Data Privacy and Security</h3>
        <p>
          We implement commercially reasonable security measures to protect your data. For more information on how we collect, use, and protect your information, please review our Privacy Policy.
        </p>

        <h3 className="text-[var(--text)] text-lg font-semibold mt-6 mb-2">4. Termination</h3>
        <p>
          We may terminate or suspend your access immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
        </p>

        <h3 className="text-[var(--text)] text-lg font-semibold mt-6 mb-2">5. Disclaimer</h3>
        <p>
          The service is provided on an &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo; basis. We disclaim all warranties, whether express or implied, including the implied warranties of merchantability, fitness for a particular purpose, and non-infringement.
        </p>

        <p className="mt-8 pt-8 border-t border-[var(--border)] text-sm">
          If you have any questions about these Terms, please contact us.
        </p>
      </div>
    </div>
  );
}
