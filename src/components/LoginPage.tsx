import React from 'react';
import { motion } from 'motion/react';
import { LogIn, Sparkles, ShieldAlert } from 'lucide-react';
import { loginWithGoogle } from '../services/firebase';
import firebaseConfig from '../../firebase-applet-config.json';

const LoginPage = () => {
  const isConfigured = firebaseConfig.apiKey !== 'placeholder';

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-brand-bg justify-center px-8 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-brand-olive/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-brand-sand/10 rounded-full blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-8"
      >
        <div className="flex justify-center">
          <motion.div 
            animate={{ 
              scale: [1, 1.05, 1],
              rotate: [0, 5, 0, -5, 0]
            }}
            transition={{ duration: 4, repeat: Infinity }}
            className="w-20 h-20 bg-brand-white rounded-[24px] shadow-xl flex items-center justify-center p-4 border border-brand-clay/10"
          >
            <Sparkles className="text-brand-olive w-10 h-10" />
          </motion.div>
        </div>

        <div>
          <h1 className="serif text-4xl font-medium text-brand-olive mb-2">NurtureAI</h1>
          <p className="text-brand-clay text-sm px-8 leading-relaxed">
            Personalized nutrition companion. Analyze your diet plans and track progress with your family.
          </p>
        </div>

        <div className="space-y-4">
          {!isConfigured && (
            <div className="p-3 bg-brand-sand/20 rounded-xl flex items-start gap-3 text-left">
              <ShieldAlert size={18} className="text-brand-olive shrink-0 mt-0.5" />
              <p className="text-[11px] text-brand-clay leading-tight">
                <strong>Cloud Provisioning in Progress:</strong> Real Google Auth is still being set up. Use "Simulated Login" to test the app now. Your data will be isolated per user in this browser.
              </p>
            </div>
          )}

          <button
            onClick={() => loginWithGoogle()}
            className="w-full bg-brand-olive text-brand-white py-5 rounded-[24px] font-bold flex items-center justify-center gap-3 shadow-xl shadow-brand-olive/10 hover:shadow-brand-olive/20 active:scale-[0.98] transition-all"
          >
            <LogIn size={20} />
            {isConfigured ? 'Sign in with Google' : 'Try Simulated Login'}
          </button>
        </div>

        <p className="text-[10px] text-brand-clay font-bold uppercase tracking-widest opacity-50">
          {isConfigured ? 'Secure multi-user cloud storage' : 'Preview Mode • Multi-user Local Storage'}
        </p>
      </motion.div>
    </div>
  );
};

export default LoginPage;
