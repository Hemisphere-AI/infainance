import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle, Shield, FileSpreadsheet, Wand2, AlertTriangle, TrendingUp, Timer, ChevronDown, ChevronUp } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import landingPageHeader from '../assets/landing_page_header.png'

const BenefitItem = ({ icon, title, description, isExpanded, onClick }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <button
        onClick={onClick}
        className="w-full p-6 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center">
          <div className="mr-4">{icon}</div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-500" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-500" />
        )}
      </button>
      {isExpanded && (
        <div className="px-6 pb-6">
          <p className="text-gray-600">{description}</p>
        </div>
      )}
    </div>
  )
}

BenefitItem.propTypes = {
  icon: PropTypes.node.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  isExpanded: PropTypes.bool.isRequired,
  onClick: PropTypes.func.isRequired
}

const LandingPage = () => {
  const { user } = useAuth()
  const [expandedBenefit, setExpandedBenefit] = useState(null)
  
  const benefits = [
    {
      id: 'financial-control',
      icon: <Shield className="w-6 h-6 text-green-600" />,
      title: "Financial Control",
      description: "Understand when you need to take action in time, minimizing cost of taking no action or even worse chance of bankruptcy."
    },
    {
      id: 'capital-raising',
      icon: <TrendingUp className="w-6 h-6 text-blue-600" />,
      title: "Faster Capital Raising",
      description: "Shorter time spent on cap raising and financial DD with quick Q&A with your financial model."
    },
    {
      id: 'build-models',
      icon: <Timer className="w-6 h-6 text-purple-600" />,
      title: "Build financial models in no time",
      description: "Spend less time building strong financial models with AI assistance."
    }
  ]

  const handleBenefitClick = (benefitId) => {
    setExpandedBenefit(expandedBenefit === benefitId ? null : benefitId)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-3">
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
            </div>
            {user ? (
              <Link
                to="/app"
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-colors duration-200"
              >
                Go to App
              </Link>
            ) : (
              <Link
                to="/login"
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-colors duration-200"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-32 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${landingPageHeader})`,
            backgroundSize: "cover",
            backgroundPosition: "center"
          }}
        />
        {/* Overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-blue-900/20 via-blue-800/10 to-orange-500/20" />
        
        <div className="relative max-w-7xl mx-auto text-center z-10">
          {user ? (
            <>
              <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 drop-shadow-lg">
                Welcome back, {user.name?.split(' ')[0] || 'User'}!
              </h1>
              <p className="text-xl text-white/90 mb-8 max-w-3xl mx-auto drop-shadow-md">
                Ready to continue working on your financial models? Upload a spreadsheet and start analyzing your data.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to="/app"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-colors duration-200 inline-flex items-center justify-center shadow-lg"
                >
                  Go to App
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 drop-shadow-lg">
                Your north star for financial planning
              </h1>
              <p className="text-xl text-white/90 mb-8 max-w-3xl mx-auto drop-shadow-md">
                Your CFO for startups who is always on. Understand complex financial models in no time and run financial scenarios to get grip on your financial position.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to="/login"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-colors duration-200 inline-flex items-center justify-center shadow-lg"
                >
                  Get Started Free
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
                <a
                  href="https://calendly.com/hemisphere/30min"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white hover:bg-gray-50 text-indigo-600 px-8 py-4 rounded-lg font-semibold text-lg transition-colors duration-200 inline-flex items-center justify-center shadow-lg border-2 border-indigo-600"
                >
                  Schedule Demo
                </a>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">The Solution</h2>
            <p className="text-lg text-gray-600 mb-8">Startups fail not because of bad ideas, but because they run out of cash. Most founders lack the financial controls to make informed decisions when it matters most. Without proper scenario planning and real-time insights, beautiful ideas with traction get stopped as they run out of cash. Here is how we solve it:</p>
          </div>
          <div className="max-w-4xl mx-auto">
            <div className="relative bg-gray-100 rounded-lg overflow-hidden shadow-lg">
              <div className="aspect-video bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </div>
                  <p className="text-lg font-medium">Demo Video Coming Soon</p>
                  <p className="text-sm opacity-90">See how Zenith transforms your financial planning</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Key Features</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6 bg-white rounded-lg shadow-sm">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileSpreadsheet className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Connects with your own sources</h3>
              <p className="text-gray-600">Google Sheets, and more. Use in places where you are.</p>
            </div>
            <div className="text-center p-6 bg-white rounded-lg shadow-sm">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Wand2 className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Understands complex financial models</h3>
              <p className="text-gray-600">AI-powered analysis of your most sophisticated financial structures.</p>
            </div>
            <div className="text-center p-6 bg-white rounded-lg shadow-sm">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-orange-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Smart alerts when unfortunate scenarios become real</h3>
              <p className="text-gray-600">Get notified when your financial assumptions need attention.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Key Benefits */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Key Benefits</h2>
          </div>
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            {/* Left Block */}
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-8 rounded-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Why Zenith Matters</h3>
              <p className="text-lg text-gray-700 leading-relaxed">
                In an age where the future is determined by the problem solvers of today, at Zenith we believe they should focus maximum on problem solving and have the financial controls at their fingertips.
              </p>
              <p className="text-lg text-gray-700 leading-relaxed mt-4">
                With better informed decisions and scenario planning, founders would have made different choices and beautiful ideas would still exist.
              </p>
            </div>
            
            {/* Right Block - Expandable Benefits */}
            <div className="space-y-4">
              {benefits.map((benefit) => (
                <BenefitItem
                  key={benefit.id}
                  icon={benefit.icon}
                  title={benefit.title}
                  description={benefit.description}
                  isExpanded={expandedBenefit === benefit.id}
                  onClick={() => handleBenefitClick(benefit.id)}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Simple Pricing</h2>
            <p className="text-lg text-gray-600">Choose the plan that works for you</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Plan */}
            <div className="border border-gray-200 rounded-lg p-8 flex flex-col h-full">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Free</h3>
                <div className="text-3xl font-bold text-gray-600 mb-2">€0<span className="text-lg text-gray-500">/month</span></div>
                <p className="text-gray-600">Perfect for getting started</p>
              </div>
              <div className="flex-grow flex flex-col">
                <ul className="space-y-3 mb-8 flex-grow">
                  <li className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />
                    <span className="text-gray-700">Financial scenario planning</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />
                    <span className="text-gray-700">Unlimited number of sheets</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />
                    <span className="text-gray-700">3 team users</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />
                    <span className="text-gray-700">500K tokens</span>
                  </li>
                </ul>
                <Link
                  to="/login"
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 py-3 rounded-lg font-semibold text-center block transition-colors duration-200"
                >
                  Get Started
                </Link>
              </div>
            </div>

            {/* Pro Plan */}
            <div className="border-2 border-indigo-500 rounded-lg p-8 relative flex flex-col h-full">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-indigo-500 text-white px-4 py-1 rounded-full text-sm font-medium">Most Popular</span>
              </div>
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Pro</h3>
                <div className="text-3xl font-bold text-black mb-2">€20<span className="text-lg text-gray-500">/month</span></div>
                <p className="text-gray-600">For growing businesses</p>
              </div>
              <div className="flex-grow flex flex-col">
                <ul className="space-y-3 mb-8 flex-grow">
                  <li className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />
                    <span className="text-gray-700">Financial scenario planning</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />
                    <span className="text-gray-700">Unlimited number of sheets</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />
                    <span className="text-gray-700">Unlimited team users</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />
                    <span className="text-gray-700">50M tokens</span>
                  </li>
                </ul>
                <Link
                  to="/login"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-semibold text-center block transition-colors duration-200"
                >
                  Start Free Trial
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Frequently Asked Questions</h2>
            <p className="text-lg text-gray-600">Everything you need to know about Zenith</p>
          </div>
          <div className="max-w-4xl mx-auto">
            <div className="space-y-4">
              <BenefitItem
                icon={<FileSpreadsheet className="w-6 h-6 text-black" />}
                title="How does Zenith connect to my existing spreadsheets?"
                description="Zenith seamlessly integrates with Google Sheets and other popular spreadsheet platforms. Simply connect your account and Zenith will automatically sync with your financial models, providing real-time analysis and insights without disrupting your existing workflow."
                isExpanded={expandedBenefit === 'faq-1'}
                onClick={() => handleBenefitClick('faq-1')}
              />
              <BenefitItem
                icon={<Wand2 className="w-6 h-6 text-green-600" />}
                title="What types of financial models can Zenith analyze?"
                description="Zenith can analyze complex financial models including cash flow projections, P&L statements, balance sheets, and scenario planning models. Our AI understands sophisticated financial structures and can provide insights on everything from startup burn rates to enterprise-level financial planning."
                isExpanded={expandedBenefit === 'faq-2'}
                onClick={() => handleBenefitClick('faq-2')}
              />
              <BenefitItem
                icon={<AlertTriangle className="w-6 h-6 text-orange-600" />}
                title="How do the smart alerts work?"
                description="Zenith continuously monitors your financial models and alerts you when key metrics deviate from your projections. You'll receive notifications about cash runway concerns, unexpected spending patterns, or when your assumptions need attention, helping you take action before problems become critical."
                isExpanded={expandedBenefit === 'faq-3'}
                onClick={() => handleBenefitClick('faq-3')}
              />
              <BenefitItem
                icon={<Shield className="w-6 h-6 text-blue-600" />}
                title="Is my financial data secure?"
                description="Yes, security is our top priority. All data is encrypted in transit and at rest, and we use enterprise-grade security measures. We never share your financial data with third parties, and you maintain full control over your information at all times."
                isExpanded={expandedBenefit === 'faq-4'}
                onClick={() => handleBenefitClick('faq-4')}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-3 mb-4 md:mb-0">
              <div className="w-6 h-6 flex items-center justify-center">
                <svg fill="#000000" height="24px" width="24px" viewBox="0 0 470 470" xmlns="http://www.w3.org/2000/svg">
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
              <span className="text-lg font-bold text-gray-800">Zenith</span>
            </div>
            <div className="flex space-x-6 text-sm text-gray-600">
              <Link to="/terms" className="hover:text-gray-700 transition-colors">Terms of Service</Link>
              <Link to="/privacy" className="hover:text-gray-700 transition-colors">Privacy Policy</Link>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200 text-center text-sm text-gray-500">
            <p>&copy; 2025 Zenith. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
