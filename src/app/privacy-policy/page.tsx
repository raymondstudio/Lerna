import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Lerna AI",
  description: "Learn about how Lerna AI collects, uses, and protects your personal information.",
  alternates: {
    canonical: "https://learn.app/privacy-policy",
  }
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-slate-200 font-body selection:bg-cyan-500/30">
      {/* Header */}
      <nav className="border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link 
            href="/" 
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group"
          >
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Back to Home</span>
          </Link>
          <div className="hidden sm:flex items-center">
            <Image
              src="/assets/lerna-full-white.png"
              alt="Lerna AI"
              width={140}
              height={32}
              className="h-8 w-auto object-contain"
            />
          </div>
          <div className="w-[120px] hidden sm:block" /> {/* Spacer */}
        </div>
      </nav>

      <div className="relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[350px] w-[350px] bg-cyan-500/10 rounded-full blur-3xl pointer-events-none z-0" />

        {/* Content */}
        <div className="mx-auto max-w-4xl px-6 py-20 relative z-10">
          <div className="mb-16 text-center">
            <h1 className="font-heading text-4xl sm:text-5xl font-bold text-white mb-6 tracking-tight">
              Privacy Policy
            </h1>
            <p className="text-lg text-slate-400 mb-4">
              How we handle your data and respect your privacy.
            </p>
            <div className="text-sm text-cyan-400 font-medium">
              Effective Date: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
          </div>

          <article className="prose prose-invert prose-slate max-w-none prose-headings:font-heading prose-headings:font-semibold prose-headings:text-white prose-p:text-slate-300 prose-li:text-slate-300 prose-a:text-cyan-400 hover:prose-a:text-cyan-300 prose-hr:border-white/10 space-y-8 text-base sm:text-lg leading-relaxed">
            
            <section>
              <h2 className="text-2xl sm:text-3xl border-b border-white/5 pb-4 mb-6">1. Introduction</h2>
              <p>
                Welcome to Lerna AI. We respect your privacy and are committed to protecting the personal information you share with us. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website, use our application, or interact with our AI-powered learning platform.
              </p>
              <p>
                Please read this policy carefully to understand our practices regarding your information. If you do not agree with this Privacy Policy, please do not use our services.
              </p>
            </section>

            <section>
              <h2 className="text-2xl sm:text-3xl border-b border-white/5 pb-4 mb-6">2. Information We Collect</h2>
              <p>We may collect information about you in various ways when you use Lerna AI:</p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li><strong>Account Information:</strong> When you register, we collect your name, email address, and authentication details (e.g., if you sign in via Google or other providers).</li>
                <li><strong>Uploaded Content:</strong> We securely process the lecture notes, PDFs, slides, and other educational materials you upload to generate study aids.</li>
                <li><strong>Conversations & Prompts:</strong> We record your chat messages, questions, and interactions with your AI tutor to maintain your learning context and study sessions.</li>
                <li><strong>Usage Data:</strong> We automatically collect diagnostic data such as device type, browser type, IP address, and platform usage metrics to ensure reliable service.</li>
                <li><strong>Cookies & Tracking:</strong> We use cookies and similar technologies to remember your preferences and analyze how our platform is used.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl sm:text-3xl border-b border-white/5 pb-4 mb-6">3. How We Use Information</h2>
              <p>The information we collect is strictly used to provide and enhance your learning experience:</p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li><strong>Service Provision:</strong> To create and manage your account, process uploaded documents, and generate accurate AI-driven explanations and quizzes.</li>
                <li><strong>Personalization:</strong> To maintain your persistent study sessions and remember your learning progress across devices.</li>
                <li><strong>Improvement:</strong> To analyze usage patterns, resolve technical issues, and improve platform performance and reliability.</li>
                <li><strong>Communication:</strong> To send you important account updates, security alerts, and technical notices.</li>
                <li><strong>Security & Integrity:</strong> To prevent fraud, detect abuse, and enforce our terms of service.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl sm:text-3xl border-b border-white/5 pb-4 mb-6">4. AI Processing and Third-Party Providers</h2>
              <p>
                Lerna AI utilizes advanced artificial intelligence models to provide personalized tutoring, document analysis, and question generation. To deliver these features, your chat inputs and uploaded study materials may be processed by trusted third-party AI infrastructure and language model providers (such as OpenAI or Anthropic).
              </p>
              <p>
                We have agreements in place to ensure that these third-party providers do not use your personal educational data to train their public or foundational models. Processing is limited to the immediate generation of your requested study materials.
              </p>
            </section>

            <section>
              <h2 className="text-2xl sm:text-3xl border-b border-white/5 pb-4 mb-6">5. Uploaded Content and Documents</h2>
              <p>
                The PDFs, presentations, and documents you upload are parsed and indexed exclusively for your personal workspace. This allows you to query your own materials securely.
              </p>
              <p>
                <strong>Important Note:</strong> While our environment is secure, we strongly advise against uploading highly sensitive, non-educational personal documents (such as financial records, health information, or confidential business IP) to the platform, as it is designed specifically for academic and learning materials.
              </p>
            </section>

            <section>
              <h2 className="text-2xl sm:text-3xl border-b border-white/5 pb-4 mb-6">6. Data Storage and Security</h2>
              <p>
                We implement reasonable administrative, technical, and physical security measures to protect your personal information and uploaded files against unauthorized access, alteration, disclosure, or destruction. Your data is encrypted in transit and at rest.
              </p>
              <p>
                However, no transmission over the Internet or electronic storage method is 100% secure. While we strive to use commercially acceptable means to protect your data, we cannot guarantee its absolute security.
              </p>
            </section>

            <section>
              <h2 className="text-2xl sm:text-3xl border-b border-white/5 pb-4 mb-6">7. Data Sharing and Disclosure</h2>
              <p>We do not sell your personal information. We only share information in the following limited circumstances:</p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li><strong>Service Providers:</strong> With trusted vendors who provide hosting, database, authentication, analytics, and AI infrastructure services necessary to operate Lerna AI.</li>
                <li><strong>Legal Requirements:</strong> If required to do so by law, in response to a subpoena, court order, or other legal process.</li>
                <li><strong>Business Transfers:</strong> In the event of a merger, acquisition, or sale of assets, user information may be transferred as a business asset.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl sm:text-3xl border-b border-white/5 pb-4 mb-6">8. Data Retention</h2>
              <p>
                We retain your account information, chat history, and uploaded materials for as long as your account remains active or as needed to provide you the services. You can delete individual documents or clear your chat history at any time through the platform interface. If you wish to delete your entire account, we will remove your personal data within a reasonable timeframe, subject to our legal obligations and dispute resolution requirements.
              </p>
            </section>

            <section>
              <h2 className="text-2xl sm:text-3xl border-b border-white/5 pb-4 mb-6">9. Your Rights and Choices</h2>
              <p>Depending on your location, you may have the right to:</p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li>Access, correct, or update the personal information associated with your account.</li>
                <li>Request the deletion of your account and associated personal data.</li>
                <li>Opt-out of non-essential cookies through your browser settings.</li>
                <li>Delete specific uploaded study materials or conversations directly within your workspace.</li>
              </ul>
              <p className="mt-4">
                To exercise any of these rights, please contact us at the email address provided below.
              </p>
            </section>

            <section>
              <h2 className="text-2xl sm:text-3xl border-b border-white/5 pb-4 mb-6">10. Children's Privacy</h2>
              <p>
                Lerna AI is designed for college and university students. Our services are not intended for or directed toward children under the age of 13 (or the minimum legal age in your jurisdiction). We do not knowingly collect personal information from children without appropriate parental consent. If we become aware that we have inadvertently collected such information, we will take reasonable steps to delete it promptly.
              </p>
            </section>

            <section>
              <h2 className="text-2xl sm:text-3xl border-b border-white/5 pb-4 mb-6">11. External Links</h2>
              <p>
                Our platform or AI-generated responses may contain links to external third-party websites for supplementary learning. We are not responsible for the privacy practices, content, or security of these external sites. We encourage you to review their respective privacy policies.
              </p>
            </section>

            <section>
              <h2 className="text-2xl sm:text-3xl border-b border-white/5 pb-4 mb-6">12. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time to reflect changes in our practices, technology, or legal requirements. We will notify you of any material changes by updating the "Effective Date" at the top of this page or by sending a direct communication. Your continued use of Lerna AI after such updates constitutes acceptance of the revised policy.
              </p>
            </section>

            <section>
              <h2 className="text-2xl sm:text-3xl border-b border-white/5 pb-4 mb-6">13. Contact Us</h2>
              <p>
                If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us at:
              </p>
              <div className="mt-6 p-6 bg-white/[0.02] border border-white/10 rounded-2xl">
                <p className="font-semibold text-white mb-2">Lerna AI Privacy Team</p>
                <p>Email: <a href="mailto:support@learn.app" className="text-cyan-400 hover:text-cyan-300">support@learn.app</a></p>
              </div>
            </section>

          </article>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-[#030b17] border-t border-white/5 pt-16 pb-8 px-6">
        <div className="mx-auto max-w-7xl flex flex-col items-center justify-center gap-8">
          <Image
            src="/assets/lerna-full-white.png"
            alt="Lerna AI"
            width={160}
            height={40}
            className="h-10 w-auto object-contain"
          />
          <div className="flex items-center gap-6 text-sm font-medium">
            <Link href="/" className="text-slate-400 hover:text-white transition-colors">Home</Link>
            <Link href="/privacy-policy" className="text-white">Privacy Policy</Link>
            <Link href="#" className="text-slate-400 hover:text-white transition-colors">Terms of Service</Link>
            <a href="mailto:support@learn.app" className="text-slate-400 hover:text-white transition-colors">Support</a>
          </div>
          <div className="w-full h-[1px] bg-white/10 mt-4" />
          <p className="text-slate-500 text-sm">
            Copyright &copy; {new Date().getFullYear()} Lerna AI. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
