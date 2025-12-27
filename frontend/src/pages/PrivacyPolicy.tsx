/**
 * Privacy Policy Page
 * Displays the privacy policy for the application
 */
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white px-5 py-4 safe-top shadow-sm border-b border-gray-100 sticky top-0 z-10">
        <div className="flex items-center gap-4 mt-4 mb-2">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Privacy Policy</h1>
            <p className="text-gray-500 text-sm">Last updated: {new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="px-5 py-6 pb-20 overflow-y-auto max-w-4xl mx-auto w-full max-h-[calc(100vh-120px)]">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8">
          <div className="prose prose-sm max-w-none">
            <section className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">1. Introduction</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Welcome to Velo ("we," "our," or "us"). We are committed to protecting your privacy and ensuring you have a positive experience on our platform. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our expense tracking application.
              </p>
              <p className="text-gray-700 leading-relaxed">
                By using Velo, you agree to the collection and use of information in accordance with this policy. If you do not agree with our policies and practices, please do not use our service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">2. Information We Collect</h2>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">2.1 Account Information</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                When you create an account, we collect:
              </p>
              <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
                <li>Email address (from your authentication provider)</li>
                <li>Display name (optional)</li>
                <li>Profile picture URL (optional)</li>
                <li>Authentication provider information (Google, GitHub)</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">2.2 Trip and Expense Data</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                When you use Velo, we collect and store:
              </p>
              <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
                <li>Trip information (name, description, dates, currency)</li>
                <li>Expense records (amount, description, date, payer, splits)</li>
                <li>Member information (display names, avatars)</li>
                <li>Debt calculations and settlement information</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">2.3 Usage Information</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                We automatically collect certain information when you use our service:
              </p>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li>Device information and browser type</li>
                <li>IP address and general location</li>
                <li>Usage patterns and feature interactions</li>
                <li>Error logs and performance data</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">3. How We Use Your Information</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                We use the information we collect to:
              </p>
              <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
                <li>Provide, maintain, and improve our service</li>
                <li>Process transactions and manage your trips and expenses</li>
                <li>Authenticate your identity and secure your account</li>
                <li>Calculate debts and settlements between trip members</li>
                <li>Send you important updates and notifications</li>
                <li>Respond to your inquiries and provide customer support</li>
                <li>Detect and prevent fraud, abuse, or security issues</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">4. Data Sharing and Disclosure</h2>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">4.1 Within Your Trips</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                Trip and expense data is shared with other members of the same trip. All members can view expenses, balances, and settlement information for trips they belong to.
              </p>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">4.2 Service Providers</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                We may share your information with third-party service providers who perform services on our behalf, such as:
              </p>
              <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
                <li>Cloud hosting and database services</li>
                <li>Authentication providers (Supabase, Google, GitHub)</li>
                <li>Analytics and monitoring services</li>
                <li>Payment processors (if applicable)</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">4.3 Legal Requirements</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                We may disclose your information if required by law or in response to valid requests by public authorities.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">5. Data Security</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the internet or electronic storage is 100% secure, and we cannot guarantee absolute security.
              </p>
              <p className="text-gray-700 leading-relaxed">
                We use industry-standard encryption, secure authentication protocols, and regular security audits to protect your data.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">6. Your Rights and Choices</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                You have the right to:
              </p>
              <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
                <li><strong>Access:</strong> Request access to your personal data</li>
                <li><strong>Correction:</strong> Update or correct your account information</li>
                <li><strong>Deletion:</strong> Request deletion of your account and associated data</li>
                <li><strong>Export:</strong> Export your trip and expense data</li>
                <li><strong>Opt-out:</strong> Unsubscribe from non-essential communications</li>
              </ul>
              <p className="text-gray-700 leading-relaxed">
                To exercise these rights, please contact us through your account settings or reach out to our support team.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">7. Data Retention</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                We retain your personal information for as long as necessary to provide our services and fulfill the purposes outlined in this Privacy Policy. When you delete your account, we will delete or anonymize your personal data, except where we are required to retain it for legal or legitimate business purposes.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">8. Children's Privacy</h2>
              <p className="text-gray-700 leading-relaxed">
                Our service is not intended for users under the age of 13. We do not knowingly collect personal information from children under 13. If you believe we have collected information from a child under 13, please contact us immediately.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">9. International Data Transfers</h2>
              <p className="text-gray-700 leading-relaxed">
                Your information may be transferred to and processed in countries other than your country of residence. These countries may have data protection laws that differ from those in your country. By using our service, you consent to the transfer of your information to these countries.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">10. Changes to This Privacy Policy</h2>
              <p className="text-gray-700 leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date. You are advised to review this Privacy Policy periodically for any changes.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-xl font-bold text-gray-900 mb-4">11. Contact Us</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                If you have any questions about this Privacy Policy or our data practices, please contact us:
              </p>
              <div className="bg-gray-50 rounded-lg p-4 text-gray-700">
                <p className="mb-2"><strong>Email:</strong> hwendev+velo@gmail.com</p>
                <p className="mb-2"><strong>Website:</strong> https://velotab.netlify.app</p>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

