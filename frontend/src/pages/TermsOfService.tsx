/**
 * Terms of Service Page
 * Displays the terms of service for the application
 */
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TermsOfService() {
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
            <h1 className="text-2xl font-bold text-gray-900">Terms of Service</h1>
            <p className="text-gray-500 text-sm">Last updated: {new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="px-5 py-6 pb-20 overflow-y-auto max-w-4xl mx-auto w-full max-h-[calc(100vh-120px)]">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8">
          <div className="prose prose-sm max-w-none">
            <section className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">1. Acceptance of Terms</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                By accessing and using Velo ("the Service"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
              </p>
              <p className="text-gray-700 leading-relaxed">
                These Terms of Service ("Terms") govern your access to and use of Velo, an expense tracking application. By using our Service, you agree to comply with and be bound by these Terms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">2. Description of Service</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Velo is a web-based application that allows users to:
              </p>
              <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
                <li>Create and manage trips with multiple members</li>
                <li>Track expenses and split costs among trip members</li>
                <li>Calculate debts and settlements between members</li>
                <li>Manage multiple currencies and exchange rates</li>
                <li>Invite others to join trips via secure invite links</li>
              </ul>
              <p className="text-gray-700 leading-relaxed">
                We reserve the right to modify, suspend, or discontinue any aspect of the Service at any time, with or without notice.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">3. User Accounts</h2>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">3.1 Account Creation</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                To use Velo, you must create an account using a supported authentication provider (Google or GitHub). You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.
              </p>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">3.2 Account Responsibilities</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                You agree to:
              </p>
              <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
                <li>Provide accurate, current, and complete information</li>
                <li>Maintain and update your account information</li>
                <li>Notify us immediately of any unauthorized use</li>
                <li>Accept responsibility for all activities under your account</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">3.3 Account Termination</h3>
              <p className="text-gray-700 leading-relaxed">
                We reserve the right to suspend or terminate your account if you violate these Terms or engage in any fraudulent, abusive, or illegal activity.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">4. User Conduct</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                You agree not to:
              </p>
              <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
                <li>Use the Service for any illegal or unauthorized purpose</li>
                <li>Violate any laws in your jurisdiction</li>
                <li>Transmit any viruses, malware, or harmful code</li>
                <li>Attempt to gain unauthorized access to the Service or its systems</li>
                <li>Interfere with or disrupt the Service or servers</li>
                <li>Impersonate any person or entity</li>
                <li>Harass, abuse, or harm other users</li>
                <li>Collect or store personal data of other users without permission</li>
                <li>Use automated systems to access the Service without authorization</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">5. Content and Data</h2>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">5.1 Your Content</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                You retain ownership of all content and data you submit to the Service, including trip information, expenses, and member data. By using the Service, you grant us a license to store, process, and display your content as necessary to provide the Service.
              </p>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">5.2 Shared Content</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                When you add content to a trip, that content becomes visible to all members of that trip. You are responsible for ensuring you have the right to share any content you add to trips.
              </p>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">5.3 Data Accuracy</h3>
              <p className="text-gray-700 leading-relaxed">
                You are responsible for the accuracy of all data you enter into the Service. We are not liable for any errors, omissions, or inaccuracies in your data or calculations based on your data.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">6. Intellectual Property</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                The Service and its original content, features, and functionality are owned by Velo and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
              </p>
              <p className="text-gray-700 leading-relaxed">
                You may not copy, modify, distribute, sell, or lease any part of the Service or included software, nor may you reverse engineer or attempt to extract the source code of the Service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">7. Payment and Fees</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Currently, Velo is provided free of charge. We reserve the right to introduce fees or subscription plans in the future. If we do so, we will provide advance notice and you may choose to discontinue use of the Service.
              </p>
              <p className="text-gray-700 leading-relaxed">
                Any future payment terms will be clearly communicated and require your explicit agreement before charges are applied.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">8. Disclaimers</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                We do not warrant that:
              </p>
              <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
                <li>The Service will be uninterrupted, secure, or error-free</li>
                <li>Defects will be corrected</li>
                <li>The Service is free of viruses or other harmful components</li>
                <li>The results obtained from using the Service will be accurate or reliable</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">9. Limitation of Liability</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, VELO SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES.
              </p>
              <p className="text-gray-700 leading-relaxed">
                Our total liability for any claims arising from or related to the Service shall not exceed the amount you paid us in the twelve (12) months preceding the claim, or $100, whichever is greater.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">10. Indemnification</h2>
              <p className="text-gray-700 leading-relaxed">
                You agree to indemnify, defend, and hold harmless Velo and its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses, including reasonable attorneys' fees, arising out of or in any way connected with your access to or use of the Service, your violation of these Terms, or your violation of any rights of another.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">11. Governing Law</h2>
              <p className="text-gray-700 leading-relaxed">
                These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which Velo operates, without regard to its conflict of law provisions. Any disputes arising from these Terms or the Service shall be resolved in the appropriate courts of that jurisdiction.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">12. Changes to Terms</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                We reserve the right to modify or replace these Terms at any time. If a revision is material, we will provide at least 30 days notice prior to any new terms taking effect.
              </p>
              <p className="text-gray-700 leading-relaxed">
                What constitutes a material change will be determined at our sole discretion. Your continued use of the Service after any changes constitutes acceptance of the new Terms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">13. Severability</h2>
              <p className="text-gray-700 leading-relaxed">
                If any provision of these Terms is found to be unenforceable or invalid, that provision will be limited or eliminated to the minimum extent necessary so that these Terms will otherwise remain in full force and effect.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">14. Entire Agreement</h2>
              <p className="text-gray-700 leading-relaxed">
                These Terms constitute the entire agreement between you and Velo regarding the use of the Service and supersede all prior agreements and understandings.
              </p>
            </section>

            <section className="mb-14">
              <h2 className="text-xl font-bold text-gray-900 mb-4">15. Contact Information</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                If you have any questions about these Terms of Service, please contact us:
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

