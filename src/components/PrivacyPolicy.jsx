import React from 'react'
import { Link } from 'react-router-dom'

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <Link to="/" className="flex items-center space-x-3">
              <div className="w-8 h-8 flex items-center justify-center">
                <svg fill="#000000" height="32px" width="32px" viewBox="0 0 470 470" xmlns="http://www.w3.org/2000/svg">
                  <path d="M464.37,227.737l-137.711-35.46l55.747-94.413c1.74-2.946,1.265-6.697-1.155-9.117c-2.42-2.42-6.169-2.894-9.117-1.154
                    l-94.413,55.747L242.263,5.63C241.41,2.316,238.422,0,235,0s-6.41,2.316-7.263,5.63l-35.46,137.711L97.865,87.593
                    c-2.947-1.742-6.697-1.267-9.117,1.154c-2.419,2.42-2.895,6.171-1.155,9.117l55.747,94.413L5.63,227.737
                    C2.316,228.59,0,231.578,0,235s2.316,6.41,5.63,7.263l137.711,35.46l-55.747,94.413c-1.74,2.946-1.265,6.697,1.155,9.117
                    c1.445,1.445,3.365,2.196,5.306,2.196c1.308,0,2.625-0.342,3.811-1.042l94.413-55.747l35.46,137.71
                    c0.854,3.313,3.841,5.63,7.263,5.63s6.41-2.316,7.263-5.63l35.46-137.711l94.413,55.748c1.187,0.701,2.503,1.042,3.811,1.042
                    c1.94,0,3.86-0.751,5.306-2.196c2.419-2.42,2.895-6.171,1.155-9.117l-55.747-94.413l137.71-35.46
                    c3.314-0.853,5.63-3.841,5.63-7.263S467.684,228.59,464.37,227.737z M287.743,287.744l23.796-6.128l43.142,73.065l-73.065-43.143
                    L287.743,287.744z M313.44,265.638c-0.035,0.009-0.07,0.019-0.106,0.027l-29.473,7.59l-22.344-22.345
                    c-2.929-2.928-7.678-2.928-10.606,0c-2.929,2.93-2.929,7.678,0,10.607l22.344,22.344l-7.59,29.478
                    c-0.008,0.033-0.018,0.065-0.025,0.099L235,432.423l-30.644-119.01c-0.004-0.016-7.61-29.552-7.61-29.552l87.115-87.116
                    l29.302,7.546c0.047,0.012,119.26,30.709,119.26,30.709L313.44,265.638z M287.743,182.256l-6.127-23.795l73.065-43.143
                    l-43.142,73.064L287.743,182.256z M265.644,156.587c0.004,0.016,7.61,29.552,7.61,29.552L235,224.393l-38.254-38.254l7.59-29.478
                    c0.008-0.033,0.018-0.065,0.025-0.099L235,37.577L265.644,156.587z M182.257,182.256l-23.796,6.128l-43.142-73.065l73.065,43.143
                    L182.257,182.256z M186.139,196.745L224.393,235l-38.254,38.255L37.577,235L186.139,196.745z M182.257,287.744l6.127,23.795
                    l-73.065,43.143l43.142-73.064L182.257,287.744z"/>
                </svg>
              </div>
              <h1 className="text-xl font-bold text-gray-800">Zenith</h1>
            </Link>
            <Link
              to="/"
              className="text-black hover:text-gray-700 font-medium"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Privacy Policy</h1>
          
          <div className="prose prose-lg max-w-none">
            <p className="text-gray-600 mb-6">Last updated: {new Date().toLocaleDateString()}</p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">1. Information We Collect</h2>
            <p className="text-gray-700 mb-4">
              We collect information you provide directly to us, such as when you create an account, use our services, or contact us for support. This may include your name, email address, and any financial data you choose to upload for analysis.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">2. How We Use Your Information</h2>
            <p className="text-gray-700 mb-4">
              We use the information we collect to provide, maintain, and improve our services, process your requests, and communicate with you. Your financial data is processed using OpenAI&apos;s services for analysis and insights generation.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">3. Data Processing with OpenAI</h2>
            <p className="text-gray-700 mb-4">
              When you upload financial data for analysis, it is processed by OpenAI&apos;s services to provide insights and analysis. This processing is done in real-time and your data is not stored by OpenAI or retained after processing. We do not store your financial data on our servers.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">4. Data Storage and Security</h2>
            <p className="text-gray-700 mb-4">
              We implement appropriate security measures to protect your personal information. Your financial data is processed in real-time and is not stored on our servers. We only retain account information necessary to provide our services.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">5. Information Sharing</h2>
            <p className="text-gray-700 mb-4">
              We do not sell, trade, or otherwise transfer your personal information to third parties except as described in this policy. We may share your information with OpenAI for processing purposes, but your data is not retained by them.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">6. Cookies and Tracking</h2>
            <p className="text-gray-700 mb-4">
              We use cookies and similar tracking technologies to enhance your experience on our website. You can control cookie settings through your browser preferences.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">7. Your Rights</h2>
            <p className="text-gray-700 mb-4">
              You have the right to access, update, or delete your personal information. You can also opt out of certain communications from us. Since we don&apos;t store your financial data, there&apos;s no financial data to delete from our systems.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">8. Data Retention</h2>
            <p className="text-gray-700 mb-4">
              We retain your account information for as long as your account is active or as needed to provide you services. Your financial data is not stored and is only processed in real-time for analysis purposes.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">9. International Data Transfers</h2>
            <p className="text-gray-700 mb-4">
              Your information may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place to protect your information in accordance with this privacy policy.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">10. Children&apos;s Privacy</h2>
            <p className="text-gray-700 mb-4">
              Our services are not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">11. Changes to This Policy</h2>
            <p className="text-gray-700 mb-4">
              We may update this privacy policy from time to time. We will notify you of any changes by posting the new privacy policy on this page and updating the &quot;Last updated&quot; date.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">12. Contact Us</h2>
            <p className="text-gray-700 mb-4">
              If you have any questions about this privacy policy, please contact us at privacy@zenith.com.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PrivacyPolicy
