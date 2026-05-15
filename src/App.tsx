import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  FileText, 
  PieChart, 
  MessageSquare, 
  ChefHat, 
  Upload,
  ArrowRight,
  TrendingUp,
  Settings,
  Calendar,
  Utensils,
  Trash2,
  Dumbbell,
  CheckCircle2,
  AlertCircle,
  Scale,
  Palette,
  LogOut,
  User as UserIcon
} from 'lucide-react';
import { analyzeDietPDF, analyzeFood, getNutritionAdvice, analyzeInBodyPDF } from './services/geminiService';
import { Diet, FoodLog, DailySummary, ExerciseLog, InBodyReport } from './types';
import { calculateDailyStats, calculateMonthlyStats, getMonthProgress } from './lib/nutrition';
import { useAuth } from './contexts/AuthContext';
import { 
  logout, 
  saveDiet, 
  saveFoodLog, 
  deleteDietFromDb, 
  deleteFoodLogFromDb,
  saveExerciseLogDb, 
  deleteExerciseLogDb,
  saveInBodyReportDb,
  deleteInBodyReportDb,
  subscribeToDiets,
  subscribeToLogs,
  subscribeToExerciseLogs,
  subscribeToInBodyReports
} from './services/firebase';
import LoginPage from './components/LoginPage';

// Components
const Card = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={`bg-brand-white rounded-[32px] p-6 shadow-sm border border-brand-clay/10 ${className}`}>
    {children}
  </div>
);

const ProgressBar = ({ current, target, color = "bg-brand-olive" }: { current: number, target: number, color?: string }) => {
  const percent = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  return (
    <div className="w-full bg-brand-bg h-1.5 rounded-full overflow-hidden">
      <motion.div 
        initial={{ width: 0 }}
        animate={{ width: `${percent}%` }}
        className={`h-full ${color}`}
      />
    </div>
  );
};

export default function App() {
  const { user, loading: authLoading } = useAuth();
  const [diets, setDiets] = useState<Diet[]>([]);
  const [logs, setLogs] = useState<FoodLog[]>([]);
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>([]);
  const [inBodyReports, setInBodyReports] = useState<InBodyReport[]>([]);
  const [activeTab, setActiveTab] = useState<'dash' | 'log' | 'advice' | 'diet' | 'exercise' | 'metrics'>('dash');
  const [selectedDietId, setSelectedDietId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDietExpanded, setIsDietExpanded] = useState(false);
  const [isAnalyzingPDF, setIsAnalyzingPDF] = useState(false);
  const [advice, setAdvice] = useState<string>("");
  const [theme, setTheme] = useState(() => localStorage.getItem('nurture_theme') || 'organic');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('nurture_theme', theme);
  }, [theme]);

  // Real-time data sync with Firebase
  useEffect(() => {
    if (!user) return;

    const unsubDiets = subscribeToDiets(user.uid, (data) => {
      const sorted = (data as Diet[]).sort(dietSortFn);
      setDiets(sorted);
    });

    const unsubLogs = subscribeToLogs(user.uid, (data) => setLogs(data as FoodLog[]));
    const unsubEx = subscribeToExerciseLogs(user.uid, (data) => setExerciseLogs(data as ExerciseLog[]));
    const unsubInBody = subscribeToInBodyReports(user.uid, (data) => setInBodyReports(data as InBodyReport[]));

    return () => {
      unsubDiets();
      unsubLogs();
      unsubEx();
      unsubInBody();
    };
  }, [user]);

  // Handle initial diet selection safely
  useEffect(() => {
    if (diets.length > 0 && !selectedDietId) {
      setSelectedDietId(diets[0].id);
    }
  }, [diets, selectedDietId]);

  // Save data functions are now obsolete as we save directly to Firestore per action
  const saveData = async () => {};

  const dietSortFn = (a: Diet, b: Diet) => {
    const yearA = a.year || new Date(a.createdAt).getFullYear();
    const yearB = b.year || new Date(b.createdAt).getFullYear();
    if (yearB !== yearA) return yearB - yearA;

    const monthA = a.monthIndex !== undefined ? a.monthIndex : new Date(a.createdAt).getMonth();
    const monthB = b.monthIndex !== undefined ? b.monthIndex : new Date(b.createdAt).getMonth();
    if (monthB !== monthA) return monthB - monthA;

    return b.createdAt - a.createdAt;
  };

  const handleDeleteLog = async (id: string) => {
    if (user) {
      await deleteFoodLogFromDb(user.uid, id);
    }
  };

  const handleDeleteExercise = async (id: string) => {
    if (user) {
      await deleteExerciseLogDb(user.uid, id);
    }
  };

  const handleDeleteReport = async (id: string) => {
    if (user) {
      await deleteInBodyReportDb(user.uid, id);
    }
  };

  const currentDiet = diets.find(d => d.id === selectedDietId) || 
    [...diets].sort(dietSortFn)[0] || null;

  const sortedDiets = [...diets].sort(dietSortFn);

  const [importStatus, setImportStatus] = useState<{ type: 'error' | 'success', message: string } | null>(null);

  useEffect(() => {
    if (importStatus) {
      const timer = setTimeout(() => setImportStatus(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [importStatus]);

  const todayStats = calculateDailyStats(logs);

  const monthProgress = getMonthProgress();
  const monthStats = calculateMonthlyStats(logs, new Date().getMonth(), new Date().getFullYear());

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzingPDF(true);
    try {
      const reader = new FileReader();
      const fileName = file.name;
      reader.onload = async (event) => {
        try {
          const base64 = (event.target?.result as string).split(',')[1];
          const result = await analyzeDietPDF(base64, fileName);
          
          const newDiet: Diet = {
            id: Math.random().toString(36).substr(2, 9),
            month: result.monthName || new Date().toLocaleString('en-US', { month: 'long' }),
            year: result.year || new Date().getFullYear(),
            monthIndex: result.monthIndex !== undefined ? result.monthIndex : new Date().getMonth(),
            extractedPlan: result.summary,
            nutritionalGoals: {
              protein: Math.round(result.targets?.protein || 0),
              carbs: Math.round(result.targets?.carbs || 0),
              fat: Math.round(result.targets?.fat || 0),
              calories: Math.round(result.targets?.calories || 0),
            },
            createdAt: Date.now()
          };

          if (user) {
            await saveDiet(user.uid, newDiet);
            setSelectedDietId(newDiet.id);
            setImportStatus({ type: 'success', message: 'Diet imported successfully!' });
          }
        } catch (err) {
          console.error(err);
          setImportStatus({ type: 'error', message: 'Error analyzing PDF. Please try again.' });
        } finally {
          setIsAnalyzingPDF(false);
        }
      };
      reader.onerror = () => {
        setImportStatus({ type: 'error', message: 'Error reading file.' });
        setIsAnalyzingPDF(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setIsAnalyzingPDF(false);
    }
  };

  const handleDeleteDiet = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (user) {
      await deleteDietFromDb(user.uid, id);
      if (selectedDietId === id) {
        setSelectedDietId(null);
      }
    }
  };

  const handleLogFood = async (foodDesc: string) => {
    setIsLoading(true);
    try {
      const result = await analyzeFood(foodDesc);
      
      // Fallback calculation if calories are missing or 0 but macros exist
      let calories = Number(result.calories) || 0;
      const protein = Number(result.protein) || 0;
      const carbs = Number(result.carbs) || 0;
      const fat = Number(result.fat) || 0;
      
      if (calories <= 0 && (protein > 0 || carbs > 0 || fat > 0)) {
        calories = (protein * 4) + (carbs * 4) + (fat * 9);
      }

      const newLog: FoodLog = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: Date.now(),
        foodName: result.foodName,
        nutrients: {
          protein,
          carbs,
          fat,
          calories
        }
      };

      if (user) {
        await saveFoodLog(user.uid, newLog);
        setActiveTab('dash');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogExercise = async (date: string) => {
    if (!user) return;
    
    const existing = exerciseLogs.find(l => l.date === date);
    if (existing) {
      await deleteExerciseLogDb(user.uid, existing.id);
    } else {
      const newEx: ExerciseLog = {
        id: Math.random().toString(36).substr(2, 9),
        date,
        type: 'CrossFit',
        timestamp: Date.now()
      };
      await saveExerciseLogDb(user.uid, newEx);
    }
  };
  
  const handleInBodyUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzingPDF(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const base64 = (event.target?.result as string).split(',')[1];
          const result = await analyzeInBodyPDF(base64);
          
          const newReport: InBodyReport = {
            id: Math.random().toString(36).substr(2, 9),
            date: result.date,
            weight: result.weight,
            smm: result.smm,
            pbf: result.pbf,
            bmi: result.bmi,
            vfa: result.vfa,
            createdAt: Date.now()
          };

          if (user) {
            await saveInBodyReportDb(user.uid, newReport);
            setActiveTab('metrics');
          }
        } catch (err) {
          console.error(err);
        } finally {
          setIsAnalyzingPDF(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setIsAnalyzingPDF(false);
    }
  };

  const getWeekStats = () => {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weeklyWorkouts = exerciseLogs.filter(l => new Date(l.date) >= oneWeekAgo);
    return weeklyWorkouts.length;
  };

  const handleGetAdvice = async (question: string) => {
    setIsLoading(true);
    try {
      const res = await getNutritionAdvice(
        todayStats,
        currentDiet?.nutritionalGoals,
        currentDiet?.extractedPlan || "No diet plan uploaded yet.",
        question
      );
      setAdvice(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const getBodyStatus = (report: InBodyReport) => {
    const { pbf, smm, weight } = report;
    let category = "";
    let desc = "";
    let nextStep = "";
    let tips: string[] = [];
    let pbfRange = { min: 5, max: 35, current: pbf };
    let targets = { pbf: "", protein: "", muscle: "" };
    
    // PBF (Percentage Body Fat) is the total mass of fat divided by total body mass, multiplied by 100.
    // It is a key metric from InBody reports to track body composition beyond just weight.
    if (pbf < 10) {
      category = "Athletic";
      nextStep = "Maintenance";
      tips = ["Focus on recovery", "Maintain muscle density", "Optimize performance"];
      targets = { pbf: "< 10%", protein: `${Math.round(weight * 2)}g`, muscle: "Maintain" };
    } else if (pbf < 14) {
      category = "Lean";
      nextStep = "Athletic";
      tips = ["Slight calorie deficit", "Increase workout intensity", "High protein intake"];
      targets = { pbf: "< 10%", protein: `${Math.round(weight * 2.2)}g`, muscle: "Maintain" };
    } else if (pbf < 19) {
      category = "Fit";
      nextStep = "Lean";
      tips = ["Consistency in CrossFit (4x/week)", "Increase protein to 2g/kg", "Cut processed sugars"];
      targets = { pbf: "< 14%", protein: `${Math.round(weight * 2.0)}g`, muscle: "Maintain" };
    } else if (pbf < 24) {
      category = "Healthy / Standard";
      nextStep = "Fit";
      tips = ["Consistency in CrossFit (3x/week)", "Increase protein to 1.8g/kg", "Track macros strictly"];
      targets = { pbf: "< 19%", protein: `${Math.round(weight * 1.8)}g`, muscle: "Build Base" };
    } else if (pbf < 29) {
      category = "Slightly High";
      nextStep = "Healthy";
      tips = ["Daily movement", "Track every meal", "Focus on compound lifts"];
      targets = { pbf: "< 24%", protein: `${Math.round(weight * 1.6)}g`, muscle: "Protect Lean Mass" };
    } else {
      category = "Overweight";
      nextStep = "Active";
      tips = ["Consistent calorie deficit", "Prioritize sleep", "Walk 10k steps daily"];
      targets = { pbf: "< 29%", protein: `${Math.round(weight * 1.5)}g`, muscle: "Preserve Tissue" };
    }

    // Muscle Modifier
    const muscleRatio = smm / weight;
    if (muscleRatio > 0.44) category = "Muscled & " + category;
    else if (muscleRatio < 0.35) category = "Soft & " + category;

    // Descriptive text
    if (pbf < 15) desc = "Elite body composition for performance.";
    else if (pbf < 22) desc = "Excellent balance of fat and muscle.";
    else if (pbf < 28) desc = "Typical healthy range for consistent activity.";
    else desc = "Focus on calorie deficit and consistent CrossFit.";

    return { category, desc, nextStep, tips, pbfRange, targets };
  };

  const getExerciseTendency = () => {
    const now = new Date();
    const startOfLoggedPeriod = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    
    const thisWeek = exerciseLogs.filter(l => {
      const d = new Date(l.date);
      return d > new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }).length;

    const lastWeek = exerciseLogs.filter(l => {
      const d = new Date(l.date);
      return d <= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) && d > startOfLoggedPeriod;
    }).length;

    const trend = thisWeek >= lastWeek ? 'up' : 'down';
    const diff = Math.abs(thisWeek - lastWeek);

    return { thisWeek, lastWeek, trend, diff };
  };

  const exerciseStats = getExerciseTendency();

  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-brand-bg">
        <motion.div 
          animate={{ rotate: 360 }} 
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }} 
          className="w-10 h-10 border-4 border-brand-olive border-t-transparent rounded-full" 
        />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto relative bg-brand-bg shadow-2xl overflow-hidden border-x border-brand-clay/10 font-sans text-brand-ink">
      {/* PDF Analysis Overlay */}
      <AnimatePresence>
        {isAnalyzingPDF && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-brand-bg/90 backdrop-blur-md flex flex-col items-center justify-center p-12 text-center"
          >
            <motion.div 
              animate={{ 
                scale: [1, 1.05, 1],
                rotate: [0, 5, -5, 0]
              }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="w-32 h-32 bg-brand-olive/10 rounded-full flex items-center justify-center mb-10 relative"
            >
              <div className="absolute inset-0 rounded-full border-2 border-brand-olive/20 animate-ping" />
              <FileText className="text-brand-olive w-12 h-12" />
            </motion.div>
            <h2 className="serif text-2xl font-medium text-brand-olive mb-4">Reading your plan...</h2>
            <div className="space-y-2">
              <p className="text-brand-clay text-sm font-medium animate-pulse">Extracting nutritional targets</p>
              <p className="text-brand-clay/40 text-[10px] uppercase tracking-widest">NurtureAI is identifying macros & rules</p>
            </div>
            
            <div className="mt-12 w-48 h-1 bg-brand-clay/10 rounded-full overflow-hidden">
              <motion.div 
                animate={{ x: [-200, 200] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                className="w-24 h-full bg-brand-olive"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="px-6 pt-10 pb-4 flex justify-between items-center bg-brand-white/80 backdrop-blur-md sticky top-0 z-10">
        <div>
          <h1 className="serif text-3xl font-medium tracking-tight text-brand-olive">NurtureAI</h1>
          <p className="text-brand-clay text-[10px] uppercase tracking-widest font-semibold mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </p>
        </div>
        <button 
          onClick={() => setActiveTab('log')}
          className="w-10 h-10 rounded-full bg-brand-clay/20 flex items-center justify-center hover:bg-brand-olive/20 transition-colors cursor-pointer"
        >
          <Utensils className="text-brand-olive w-5 h-5" />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-6 pb-24">
        <AnimatePresence mode="wait">
          {activeTab === 'dash' && (
            <motion.div 
              key="dash"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6 pt-4"
            >
              {!currentDiet ? (
                <Card className="bg-brand-olive text-brand-white border-none relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <TrendingUp size={80} />
                  </div>
                  <h3 className="serif text-2xl font-medium mb-2 pr-12 text-brand-white">Begin your journey.</h3>
                  <p className="text-brand-bg/80 text-sm mb-6 leading-relaxed">Connect your doctor's monthly PDF plans to receive AI-powered meal insights.</p>
                  <button 
                    onClick={() => setActiveTab('diet')}
                    className="w-full bg-brand-white text-brand-olive py-4 rounded-2xl font-semibold flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-transform"
                  >
                    <Upload size={18} /> Upload PDF Plan
                  </button>
                </Card>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="bg-brand-white border-brand-olive/10 col-span-2 relative overflow-hidden group">
                      <div className="absolute -right-4 -top-4 w-24 h-24 bg-brand-olive/5 rounded-full group-hover:scale-110 transition-transform" />
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-brand-clay block mb-1">Calories Today</span>
                          <div className="text-4xl font-semibold serif text-brand-olive">{todayStats.calories} <span className="text-base font-normal opacity-40">kcal</span></div>
                        </div>
                        <span className="text-[10px] bg-brand-bg text-brand-olive px-3 py-1 rounded-full font-bold uppercase tracking-wider border border-brand-olive/5">
                          {currentDiet?.month}
                        </span>
                      </div>
                      <ProgressBar current={todayStats.calories} target={currentDiet?.nutritionalGoals.calories || 2000} />
                      <div className="flex justify-between mt-3">
                        <p className="text-[10px] text-brand-clay font-medium uppercase tracking-wider">
                          {currentDiet && currentDiet.nutritionalGoals.calories > 0 
                            ? Math.round((todayStats.calories / currentDiet.nutritionalGoals.calories) * 100) 
                            : 0}% of target
                        </p>
                        <p className="text-[10px] text-brand-clay font-medium uppercase tracking-wider">Goal: {currentDiet?.nutritionalGoals.calories || 0}</p>
                      </div>
                    </Card>

                    <Card>
                      <div className="flex flex-col h-full">
                        <span className="text-[10px] text-brand-clay uppercase font-bold tracking-widest mb-3">Protein</span>
                        <div className="text-2xl font-semibold serif text-brand-olive mb-4">{todayStats.protein}g</div>
                        <ProgressBar current={todayStats.protein} target={currentDiet?.nutritionalGoals.protein || 150} color="bg-brand-clay" />
                         <span className="text-[10px] mt-3 text-brand-clay/60 block">{currentDiet?.nutritionalGoals.protein || 0}g target</span>
                      </div>
                    </Card>

                    <Card>
                      <div className="flex flex-col h-full">
                        <span className="text-[10px] text-brand-clay uppercase font-bold tracking-widest mb-3">Carbohydrates</span>
                        <div className="text-2xl font-semibold serif text-brand-sand mb-4">{todayStats.carbs}g</div>
                        <ProgressBar current={todayStats.carbs} target={currentDiet?.nutritionalGoals.carbs || 200} color="bg-brand-sand" />
                        <span className="text-[10px] mt-3 text-brand-clay/60 block">{currentDiet?.nutritionalGoals.carbs || 0}g target</span>
                      </div>
                    </Card>
                  </div>

                  {/* Monthly Projection */}
                  <Card className="bg-brand-ink text-brand-bg border-none">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h4 className="serif text-xl text-brand-sand">Monthly Forecast</h4>
                        <p className="text-[9px] text-brand-bg/40 uppercase font-bold tracking-widest mt-1">Day {monthProgress.elapsedDays} of {monthProgress.totalDays}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] bg-brand-white/10 text-brand-sand px-2 py-1 rounded font-bold">
                          {Math.round(monthProgress.percentage)}% Month
                        </span>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div>
                        <div className="flex justify-between text-[10px] uppercase font-bold tracking-widest mb-2">
                          <span className="opacity-60">Protein Accumulation</span>
                          <span className="text-brand-sand">{Math.round(monthStats.protein)} / {Math.round((currentDiet?.nutritionalGoals?.protein || 150) * monthProgress.totalDays)}g</span>
                        </div>
                        <div className="h-1.5 w-full bg-brand-white/10 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, (monthStats.protein / ((currentDiet?.nutritionalGoals?.protein || 150) * monthProgress.totalDays)) * 100)}%` }}
                            className="h-full bg-brand-sand"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[10px] uppercase font-bold tracking-widest mb-2">
                          <span className="opacity-60">Energy Consumed</span>
                          <span className="text-brand-sand">{Math.round(monthStats.calories / 1000)}k / {Math.round(((currentDiet?.nutritionalGoals?.calories || 2000) * monthProgress.totalDays) / 1000)}k kcal</span>
                        </div>
                        <div className="h-1.5 w-full bg-brand-white/10 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, (monthStats.calories / ((currentDiet?.nutritionalGoals?.calories || 2000) * monthProgress.totalDays)) * 100)}%` }}
                            className="h-full bg-brand-white/40"
                          />
                        </div>
                      </div>

                      <p className="text-[9px] text-brand-bg/40 leading-tight italic pt-2">
                        This projection tracks your actual logs against the full monthly budget from your plan for {currentDiet?.month || 'diet'}.
                      </p>
                    </div>
                  </Card>

                  {/* Activity Intensity Card */}
                  <Card className="p-6 border-brand-olive/10 bg-brand-white relative overflow-hidden">
                    <div className="absolute right-0 top-0 p-6 opacity-5 rotate-12">
                      <Dumbbell size={80} />
                    </div>
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h3 className="serif text-xl text-brand-olive">Activity Intensity</h3>
                        <p className="text-[9px] text-brand-clay uppercase font-bold tracking-widest">CrossFit Weekly Tendency</p>
                      </div>
                      <div className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${exerciseStats.trend === 'up' ? 'bg-green-100 text-green-700' : 'bg-brand-sand/20 text-brand-ink'}`}>
                        {exerciseStats.trend === 'up' ? '↗ Increasing' : '↘ Steady'}
                      </div>
                    </div>

                    <div className="flex items-end gap-2 h-20 mb-6">
                      {Array.from({ length: 7 }).map((_, i) => {
                        const d = new Date();
                        d.setDate(d.getDate() - (6 - i));
                        const dateStr = d.toISOString().split('T')[0];
                        const isLogged = exerciseLogs.some(l => l.date === dateStr);
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full">
                            <motion.div 
                              initial={{ height: 0 }}
                              animate={{ height: isLogged ? '100%' : '15%' }}
                              className={`w-full rounded-t-lg transition-all duration-500 ${isLogged ? 'bg-brand-olive shadow-[0_-4px_12px_rgba(var(--brand-olive-rgb),0.2)]' : 'bg-brand-clay/5'}`}
                            />
                            <span className="text-[8px] font-bold text-brand-clay/30 uppercase">
                              {d.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0)}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t border-brand-clay/5 pt-6">
                      <div>
                        <p className="text-[9px] text-brand-clay uppercase font-bold tracking-widest mb-1">Consistency</p>
                        <p className="text-2xl font-semibold serif text-brand-olive">{exerciseStats.thisWeek} <span className="text-xs font-sans text-brand-clay lowercase">days</span></p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] text-brand-clay uppercase font-bold tracking-widest mb-1">vs Last Week</p>
                        <p className={`text-xl font-semibold serif ${exerciseStats.trend === 'up' ? 'text-green-600' : 'text-brand-ink'}`}>
                          {exerciseStats.trend === 'up' ? '+' : ''}{exerciseStats.thisWeek - exerciseStats.lastWeek} <span className="text-xs font-sans text-brand-clay lowercase">diff</span>
                        </p>
                      </div>
                    </div>
                  </Card>

                  <div className="pt-8 pb-12">
                    <h4 className="serif text-lg mb-4 text-brand-olive flex items-center gap-2">
                       <UserIcon size={18} /> User Account
                    </h4>
                    <div className="p-4 bg-brand-white rounded-2xl border border-brand-clay/10">
                      <div className="flex items-center gap-4 mb-6">
                        {user.photoURL ? (
                          <img src={user.photoURL} alt={user.displayName || 'User'} className="w-12 h-12 rounded-full" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-brand-olive/10 flex items-center justify-center text-brand-olive">
                            <UserIcon size={24} />
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-brand-ink">{user.displayName || 'Anonymous'}</p>
                          <p className="text-[10px] text-brand-clay uppercase tracking-widest">{user.email}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => logout()}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-red-50 text-red-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-red-100 transition-colors"
                      >
                        <LogOut size={16} /> Sign Out
                      </button>
                    </div>
                  </div>

                  <div className="pt-4 pb-12">
                    <h4 className="serif text-lg mb-4 text-brand-olive flex items-center gap-2">
                       <Palette size={18} /> App Appearance
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: 'organic', name: 'Organic', color: '#6B705C' },
                        { id: 'midnight', name: 'Midnight', color: '#00D1FF' },
                        { id: 'wellness', name: 'Wellness', color: '#E07A5F' },
                        { id: 'nordic', name: 'Nordic', color: '#475569' }
                      ].map(t => (
                        <button
                          key={t.id}
                          onClick={() => setTheme(t.id)}
                          className={`
                            p-3 rounded-2xl border-2 transition-all flex flex-col items-center gap-2
                            ${theme === t.id ? 'border-brand-olive bg-brand-olive/10' : 'border-brand-clay/10 bg-brand-white'}
                          `}
                        >
                          <div className="w-5 h-5 rounded-full border border-black/5" style={{ backgroundColor: t.color }} />
                          <span className="text-[10px] font-bold uppercase tracking-widest">{t.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {activeTab === 'log' && (
            <motion.div 
              key="log"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6 pt-4"
            >
              <h2 className="serif text-3xl font-medium text-brand-olive">Add Entry</h2>
              <Card>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const target = e.target as typeof e.target & {
                    food: { value: string };
                  };
                  handleLogFood(target.food.value);
                  target.food.value = '';
                }}>
                  <div className="space-y-6">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-brand-clay block mb-3">Describe your meal</label>
                      <textarea 
                        name="food"
                        required
                        placeholder="e.g. A bowl of oats with blueberries and almonds"
                        className="w-full p-5 rounded-2xl bg-brand-bg/50 border border-brand-clay/10 h-40 focus:ring-1 focus:ring-brand-olive focus:bg-brand-white outline-none transition-all placeholder:text-brand-clay/40"
                      />
                    </div>
                    <button 
                      disabled={isLoading}
                      type="submit"
                      className="w-full bg-brand-olive text-brand-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg shadow-brand-olive/10 active:scale-95 transition-transform disabled:opacity-50"
                    >
                      {isLoading ? "Analyzing..." : <><Plus size={20} /> Log Meal</>}
                    </button>
                  </div>
                </form>
              </Card>

              <div className="pt-8">
                <h3 className="serif text-xl font-medium mb-4 text-brand-olive flex items-center gap-2">
                   Recent Logs
                </h3>
                <div className="space-y-3">
                  {logs.slice(0, 10).map(log => {
                    const logDate = new Date(log.timestamp).toDateString();
                    const isToday = logDate === new Date().toDateString();
                    return (
                      <div key={log.id} className="flex items-center justify-between p-4 bg-brand-white rounded-2xl border border-brand-clay/10 hover:border-brand-olive/20 transition-colors group">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-brand-olive/5 flex items-center justify-center text-brand-olive shrink-0">
                            <Utensils size={16} />
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-brand-ink">{log.foodName}</p>
                            <p className="text-[10px] text-brand-clay uppercase font-bold tracking-wider mt-0.5">
                              {Math.round(log.nutrients.calories)} kcal • {Math.round(log.nutrients.protein)}g protein
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-right">
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] text-brand-clay font-medium">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {!isToday && (
                              <span className="text-[8px] text-brand-clay/60 uppercase font-bold tracking-tighter">
                                {new Date(log.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                              </span>
                            )}
                          </div>
                          <button 
                            onClick={() => handleDeleteLog(log.id)}
                            className="p-2 text-brand-clay/40 hover:text-red-500 hover:bg-red-50 rounded-full transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                            title="Delete log"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {logs.length === 0 && (
                    <div className="text-center py-6">
                       <p className="text-xs text-brand-clay italic opacity-60">No food logged yet.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 justify-center px-8 mt-10">
                 <div className="h-[1px] flex-1 bg-brand-clay/10" />
                 <p className="text-[10px] font-bold text-brand-clay uppercase tracking-widest">AI Extraction Engine</p>
                 <div className="h-[1px] flex-1 bg-brand-clay/10" />
              </div>
            </motion.div>
          )}

          {activeTab === 'advice' && (
            <motion.div 
              key="advice"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-6 pt-4"
            >
                <h2 className="serif text-3xl font-medium text-brand-olive">AI Insight</h2>
                <div className="bg-brand-olive/5 border-l-4 border-brand-olive p-6 rounded-r-3xl rounded-bl-3xl">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-brand-olive block mb-2">AI Nutritionist</span>
                  <div className="text-sm text-brand-ink leading-relaxed italic prose-sm markdown-content">
                    {advice ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{advice}</ReactMarkdown>
                    ) : (
                      "I'm monitoring your plan. Ask me about substitutions or how to meet your macro goals for today."
                    )}
                    {isLoading && <span className="block mt-4 animate-pulse font-sans font-bold uppercase text-[10px] tracking-widest">Consulting knowledge base...</span>}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-brand-clay uppercase tracking-widest mb-2 px-2">Common Queries</p>
                  <button 
                    onClick={() => handleGetAdvice("I haven't eaten enough protein today. Suggest something for dinner.")}
                    className="w-full text-left p-4 bg-brand-white rounded-2xl text-xs font-semibold text-brand-olive border border-brand-clay/10 hover:bg-brand-olive hover:text-brand-white transition-all group"
                  >
                    "I need more protein, what should I eat?"
                  </button>
                  <button 
                    onClick={() => handleGetAdvice("I want to skip lunch and have a double dinner. Does that work with my plan?")}
                    className="w-full text-left p-4 bg-brand-white rounded-2xl text-xs font-semibold text-brand-olive border border-brand-clay/10 hover:bg-brand-olive hover:text-brand-white transition-all group"
                  >
                    "Can I modify my diet for today?"
                  </button>
                  
                  <div className="pt-6">
                    <div className="flex gap-2 p-2 bg-brand-white rounded-3xl border border-brand-clay/20 shadow-sm focus-within:border-brand-olive transition-colors">
                      <input 
                        type="text" 
                        placeholder="Ask the AI advisor..."
                        className="flex-1 px-4 bg-transparent border-none text-sm outline-none placeholder:text-brand-clay/50 font-medium"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleGetAdvice(e.currentTarget.value);
                        }}
                      />
                      <button 
                        onClick={(e) => {
                           const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                           handleGetAdvice(input.value);
                        }}
                        className="p-3 bg-brand-olive text-brand-white rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-brand-olive/20"
                      >
                        <ArrowRight size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
          )}

          {activeTab === 'exercise' && (
            <motion.div 
              key="exercise"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6 pt-4 pb-20"
            >
              <div className="flex items-center justify-between">
                <h2 className="serif text-3xl font-medium text-brand-olive">Activity</h2>
                <div className="flex items-center gap-2 px-3 py-1 bg-brand-olive/10 rounded-full">
                  <TrendingUp size={14} className="text-brand-olive" />
                  <span className="text-[10px] font-bold text-brand-olive uppercase tracking-widest">{getWeekStats()} session{getWeekStats() !== 1 ? 's' : ''} this week</span>
                </div>
              </div>

              <Card className="p-0 overflow-hidden border-brand-olive/10">
                <div className="p-6 bg-brand-olive/5 border-b border-brand-olive/10">
                  <h3 className="serif text-lg text-brand-olive">CrossFit Tracker</h3>
                  <p className="text-[9px] text-brand-clay uppercase font-bold tracking-widest mt-1">Mark your sessions on the calendar</p>
                </div>
                
                <div className="p-4 bg-brand-white">
                  <div className="grid grid-cols-7 gap-2">
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                      <div key={i} className="text-center text-[10px] font-bold text-brand-clay opacity-40 py-2">
                        {day}
                      </div>
                    ))}
                    {Array.from({ length: 35 }).map((_, i) => {
                      const today = new Date();
                      const dayOfWeek = today.getDay() || 7; // 1-7 (Mon-Sun)
                      const startDate = new Date(today);
                      startDate.setDate(today.getDate() - dayOfWeek + 1 - 28); // Start Monday 4 weeks ago
                      
                      const date = new Date(startDate);
                      date.setDate(startDate.getDate() + i);
                      
                      const dateStr = date.toISOString().split('T')[0];
                      const isLogged = exerciseLogs.some(l => l.date === dateStr);
                      const isToday = new Date().toISOString().split('T')[0] === dateStr;
                      
                      return (
                        <button
                          key={dateStr}
                          onClick={() => handleLogExercise(dateStr)}
                          className={`
                            aspect-square rounded-xl flex items-center justify-center transition-all relative group
                            ${isLogged ? 'bg-brand-olive text-brand-white shadow-md shadow-brand-olive/20' : 'bg-brand-bg hover:bg-brand-olive/10 text-brand-clay'}
                            ${isToday && !isLogged ? 'ring-2 ring-brand-olive/30 ring-offset-2' : ''}
                          `}
                        >
                          <span className="text-xs font-bold">{date.getDate()}</span>
                          {isLogged && (
                            <motion.div 
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute -top-1 -right-1 bg-brand-white rounded-full p-0.5 shadow-sm"
                            >
                              <CheckCircle2 size={8} className="text-brand-olive" />
                            </motion.div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="p-6 bg-brand-bg/50 border-t border-brand-clay/5">
                   <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-full bg-brand-olive/10 flex items-center justify-center">
                       <Dumbbell size={18} className="text-brand-olive" />
                     </div>
                     <div>
                       <p className="text-xs font-bold text-brand-ink">CrossFit Routine</p>
                       <p className="text-[10px] text-brand-clay leading-tight">AI will adjust your meal advice based on your weekly workload.</p>
                     </div>
                   </div>
                </div>
              </Card>

              <div className="pt-2">
                <h3 className="serif text-xl font-medium mb-4 text-brand-olive">Recent History</h3>
                <div className="space-y-3">
                  {exerciseLogs.slice().reverse().slice(0, 10).map(log => (
                    <div key={log.id} className="flex items-center justify-between p-4 bg-brand-white rounded-2xl border border-brand-clay/10 group">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-brand-olive/5 rounded-lg">
                          <Dumbbell size={14} className="text-brand-olive" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-brand-ink">{log.type}</p>
                          <p className="text-[10px] text-brand-clay uppercase tracking-widest">{new Date(log.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] bg-brand-olive/10 text-brand-olive px-2 py-1 rounded-md font-bold">COMPLETED</span>
                        <button 
                          onClick={() => handleDeleteExercise(log.id)}
                          className="p-2 text-brand-clay/40 hover:text-red-500 hover:bg-red-50 rounded-full transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {exerciseLogs.length === 0 && (
                    <div className="text-center py-10">
                      <p className="text-sm text-brand-clay italic">No workouts logged yet. Start today!</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
          {activeTab === 'metrics' && (
            <motion.div 
              key="metrics"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6 pt-4 pb-20"
            >
              <div className="flex items-center justify-between mb-2">
                <h2 className="serif text-3xl font-medium text-brand-olive">Body Metrics</h2>
                <label className="p-2 bg-brand-olive/10 text-brand-olive rounded-full cursor-pointer hover:bg-brand-olive hover:text-brand-white transition-all">
                  <Plus size={20} />
                  <input type="file" className="hidden" accept="application/pdf" onChange={handleInBodyUpload} />
                </label>
              </div>

              {inBodyReports.length > 0 ? (
                <>
                  <Card className="bg-brand-olive text-brand-white border-none p-0 overflow-hidden shadow-2xl shadow-brand-olive/20">
                    <div className="p-6 bg-brand-olive/90">
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">Latest Scan: {new Date(inBodyReports[0].date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                          <h3 className="serif text-2xl">Composition Overview</h3>
                        </div>
                        <div className="bg-brand-white/20 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
                          {getBodyStatus(inBodyReports[0]).category}
                        </div>
                      </div>

                      {/* Visual PBF Scale */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-[7.5px] font-black uppercase tracking-widest opacity-40">
                          <span>Overweight</span>
                          <span>High</span>
                          <span>Healthy</span>
                          <span>Fit</span>
                          <span>Lean</span>
                          <span>Athletic</span>
                        </div>
                        <div className="h-1.5 w-full bg-brand-white/10 rounded-full relative overflow-hidden">
                          <div className="absolute inset-0 flex">
                            <div className="h-full bg-brand-white/10 w-[20%] border-r border-brand-white/5" />
                            <div className="h-full bg-brand-white/10 w-[20%] border-r border-brand-white/5" />
                            <div className="h-full bg-brand-white/10 w-[20%] border-r border-brand-white/5" />
                            <div className="h-full bg-brand-white/10 w-[20%] border-r border-brand-white/5" />
                            <div className="h-full bg-brand-white/10 w-[20%]" />
                          </div>
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, Math.max(0, ((35 - inBodyReports[0].pbf) / (35 - 5)) * 100))}%` }}
                            className="h-full bg-brand-white shadow-[0_0_10px_rgba(255,255,255,0.5)] relative z-10"
                          />
                        </div>
                        <div className="flex justify-between text-[8px] font-bold opacity-60">
                          <span>35% body fat</span>
                          <span>5% body fat</span>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-brand-white/10">
                        <p className="text-[9px] leading-relaxed opacity-60">
                          <strong>What is PBF?</strong> Percentage Body Fat measures what part of your weight is fat vs. muscle/bone. It's the gold standard for CrossFit progress.
                        </p>
                      </div>
                    </div>
                    
                    <div className="p-6 grid grid-cols-2 gap-6 bg-brand-olive">
                      <div>
                        <p className="text-[10px] uppercase font-bold opacity-60 tracking-widest mb-1">Weight</p>
                        <p className="text-3xl font-semibold serif">{inBodyReports[0].weight} <span className="text-sm font-sans font-normal opacity-60">kg</span></p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold opacity-60 tracking-widest mb-1">Muscle (SMM)</p>
                        <p className="text-3xl font-semibold serif">{inBodyReports[0].smm} <span className="text-sm font-sans font-normal opacity-60">kg</span></p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold opacity-60 tracking-widest mb-1">Body Fat (PBF)</p>
                        <p className="text-3xl font-semibold serif">{inBodyReports[0].pbf} <span className="text-sm font-sans font-normal opacity-60">%</span></p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold opacity-60 tracking-widest mb-1">BMI</p>
                        <p className="text-3xl font-semibold serif">{inBodyReports[0].bmi}</p>
                      </div>
                    </div>
                    <div className="p-4 bg-brand-ink text-brand-bg/60 text-[10px] italic text-center border-t border-brand-white/5">
                      Feedback: "{getBodyStatus(inBodyReports[0]).desc}"
                    </div>
                  </Card>

                  {/* Advice Card */}
                  <Card className="p-6 border-brand-olive/10 bg-brand-white">
                    <div className="flex items-center gap-2 mb-6">
                      <div className="p-2 bg-brand-olive/10 rounded-lg">
                        <TrendingUp size={16} className="text-brand-olive" />
                      </div>
                      <div>
                        <h3 className="serif text-lg text-brand-olive">Road to {getBodyStatus(inBodyReports[0]).nextStep}</h3>
                        <p className="text-[9px] text-brand-clay uppercase font-bold tracking-widest">Recommended Focus & Targets</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3 mb-6">
                       <div className="p-3 bg-brand-bg rounded-2xl border border-brand-clay/5 text-center">
                          <p className="text-[8px] font-bold text-brand-clay uppercase tracking-widest mb-1">Target PBF</p>
                          <p className="text-sm font-bold text-brand-olive">{getBodyStatus(inBodyReports[0]).targets.pbf}</p>
                       </div>
                       <div className="p-3 bg-brand-bg rounded-2xl border border-brand-clay/5 text-center">
                          <p className="text-[8px] font-bold text-brand-clay uppercase tracking-widest mb-1">Min Protein</p>
                          <p className="text-sm font-bold text-brand-olive">{getBodyStatus(inBodyReports[0]).targets.protein}</p>
                       </div>
                       <div className="p-3 bg-brand-bg rounded-2xl border border-brand-clay/5 text-center">
                          <p className="text-[8px] font-bold text-brand-clay uppercase tracking-widest mb-1">Muscle Goal</p>
                          <p className="text-sm font-bold text-brand-olive">{getBodyStatus(inBodyReports[0]).targets.muscle}</p>
                       </div>
                    </div>

                    <div className="space-y-3">
                      {getBodyStatus(inBodyReports[0]).tips.map((tip, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-brand-clay/10 shadow-sm">
                          <CheckCircle2 size={14} className="text-brand-olive" />
                          <span className="text-xs font-medium text-brand-ink">{tip}</span>
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-6 p-4 rounded-2xl bg-brand-olive/5 border border-brand-olive/10">
                      <p className="text-[10px] text-brand-olive leading-relaxed">
                        Moving from <strong>{getBodyStatus(inBodyReports[0]).category}</strong> to <strong>{getBodyStatus(inBodyReports[0]).nextStep}</strong> requires consistent metabolic demand through CrossFit and precise protein timing.
                      </p>
                    </div>
                  </Card>

                  <div className="pt-2">
                    <h3 className="serif text-xl font-medium mb-4 text-brand-olive">Report History</h3>
                    <div className="space-y-3">
                      {inBodyReports.map(report => (
                        <div key={report.id} className="bg-brand-white border border-brand-clay/10 p-5 rounded-3xl flex items-center justify-between group">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-brand-bg flex items-center justify-center">
                              <Scale size={18} className="text-brand-olive" />
                            </div>
                            <div>
                               <p className="text-sm font-bold text-brand-ink">{new Date(report.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                               <p className="text-[10px] text-brand-clay font-bold uppercase tracking-widest">{report.weight}kg • {report.pbf}% Fat</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                               <div className="text-xs font-bold text-brand-olive">{report.smm}kg Muscle</div>
                            </div>
                            <button 
                              onClick={() => handleDeleteReport(report.id)}
                              className="p-2 text-brand-clay/40 hover:text-red-500 hover:bg-red-50 rounded-full transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                  <div className="w-24 h-24 bg-brand-olive/5 rounded-full flex items-center justify-center mb-8">
                    <Scale size={40} className="text-brand-clay" />
                  </div>
                  <h3 className="serif text-2xl font-medium mb-3 text-brand-olive">InBody Reports</h3>
                  <p className="text-brand-clay text-sm mb-10 leading-relaxed max-w-[240px]">Upload your InBody measurements PDF to track your body composition progress.</p>
                  <label className="w-full bg-brand-olive text-brand-white py-5 rounded-2xl font-bold flex items-center justify-center gap-3 cursor-pointer shadow-xl shadow-brand-olive/20 transition-all hover:bg-brand-ink active:scale-95">
                    <Upload size={20} /> Select InBody PDF
                    <input type="file" className="hidden" accept="application/pdf" onChange={handleInBodyUpload} />
                  </label>
                </div>
              )}
            </motion.div>
          )}
          {activeTab === 'diet' && (
            <motion.div 
              key="diet"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6 pt-4 pb-20"
            >
              <div className="flex items-center justify-between mb-2">
                <h2 className="serif text-3xl font-medium text-brand-olive">Clinical Plans</h2>
                <label className="p-2 bg-brand-olive/10 text-brand-olive rounded-full cursor-pointer hover:bg-brand-olive hover:text-brand-white transition-all">
                  <Plus size={20} />
                  <input type="file" className="hidden" accept="application/pdf" onChange={handleFileUpload} />
                </label>
              </div>

              {diets.length > 0 ? (
                <div className="space-y-6">
                  {/* Current Active Highlight */}
                  {currentDiet && (
                    <Card className="relative overflow-hidden border-brand-olive/30 bg-brand-olive/5">
                      <div className="absolute top-0 right-0 px-3 py-1 bg-brand-olive text-brand-white text-[8px] font-bold uppercase tracking-[0.2em] rounded-bl-xl">
                        Selected Plan
                      </div>
                      <div className="flex justify-between items-start mb-6">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-xl bg-brand-sand flex items-center justify-center text-brand-white font-bold text-xs font-sans">
                            PDF
                          </div>
                          <div>
                            <p className="font-bold serif text-lg text-brand-olive">Plan for {currentDiet.month} {currentDiet.year}</p>
                            <p className="text-[9px] text-brand-clay font-bold uppercase tracking-widest mt-0.5">Goal: {Math.round(currentDiet.nutritionalGoals.calories)} kcal</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setIsDietExpanded(true)}
                          className="p-2 bg-brand-bg rounded-lg text-brand-olive hover:bg-brand-olive hover:text-brand-white transition-all shadow-sm"
                          title="Expand plan"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
            <div className="space-y-4">
                        <div className="text-xs text-brand-ink leading-relaxed opacity-80 max-h-48 overflow-y-auto pr-2 custom-scrollbar markdown-content">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentDiet.extractedPlan}</ReactMarkdown>
                        </div>
                        <div className="grid grid-cols-3 gap-2 pt-4 border-t border-brand-clay/10">
                          <div className="text-center">
                            <p className="text-[8px] font-bold text-brand-clay uppercase tracking-tighter">Protein</p>
                            <p className="text-sm font-semibold serif text-brand-olive">{currentDiet.nutritionalGoals.protein}g</p>
                          </div>
                          <div className="text-center">
                             <p className="text-[8px] font-bold text-brand-clay uppercase tracking-tighter">Carbs</p>
                            <p className="text-sm font-semibold serif text-brand-olive">{currentDiet.nutritionalGoals.carbs}g</p>
                          </div>
                          <div className="text-center">
                             <p className="text-[8px] font-bold text-brand-clay uppercase tracking-tighter">Fat</p>
                            <p className="text-sm font-semibold serif text-brand-olive">{currentDiet.nutritionalGoals.fat}g</p>
                          </div>
                        </div>
                      </div>
                    </Card>
                  )}

                  {/* History List */}
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold text-brand-clay uppercase tracking-widest px-1">Plan History</p>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {sortedDiets.map(diet => (
                        <div 
                          key={diet.id}
                          onClick={() => setSelectedDietId(diet.id)}
                          className={`w-full flex items-center justify-between p-4 rounded-3xl border transition-all cursor-pointer ${
                            selectedDietId === diet.id 
                              ? 'bg-brand-white border-brand-olive/30 shadow-sm' 
                              : 'bg-transparent border-brand-clay/10 hover:border-brand-clay/30'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl pointer-events-none ${selectedDietId === diet.id ? 'bg-brand-olive text-brand-white' : 'bg-brand-clay/10 text-brand-clay'}`}>
                              <FileText size={16} />
                            </div>
                            <div className="text-left pointer-events-none">
                              <p className={`text-sm font-bold ${selectedDietId === diet.id ? 'text-brand-olive' : 'text-brand-ink'}`}>{diet.month} {diet.year || ''} Plan</p>
                              <p className="text-[9px] text-brand-clay">{new Date(diet.createdAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {selectedDietId === diet.id && <div className="w-2 h-2 rounded-full bg-brand-olive shrink-0" />}
                            <button 
                              onClick={(e) => handleDeleteDiet(diet.id, e)}
                              aria-label="Delete plan"
                              className="p-3 text-brand-clay/60 hover:text-red-500 hover:bg-red-50 rounded-full transition-all cursor-pointer relative z-20 group"
                            >
                              <Trash2 size={18} className="group-active:scale-95 group-hover:scale-110 transition-transform" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                  <div className="w-24 h-24 bg-brand-olive/5 rounded-full flex items-center justify-center mb-8">
                    <FileText size={40} className="text-brand-clay" />
                  </div>
                  <h3 className="serif text-2xl font-medium mb-3 text-brand-olive">Upload your clinical diet.</h3>
                  <p className="text-brand-clay text-sm mb-10 leading-relaxed max-w-[240px]">We'll automatically extract macro goals from your doctor's PDF plan.</p>
                  <label className="w-full bg-brand-olive text-brand-white py-5 rounded-2xl font-bold flex items-center justify-center gap-3 cursor-pointer shadow-xl shadow-brand-olive/20 transition-all hover:bg-brand-ink active:scale-95">
                    {isLoading ? "Processing..." : (
                      <><Upload size={20} /> Select PDF File</>
                    )}
                    <input type="file" className="hidden" accept="application/pdf" onChange={handleFileUpload} />
                  </label>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>      {/* Bottom Nav */}
      <AnimatePresence>
        {isDietExpanded && currentDiet && (
          <motion.div 
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            className="fixed inset-0 z-[60] bg-brand-bg flex flex-col pt-12"
          >
              <div className="px-6 pb-4 border-b border-brand-clay/10 flex justify-between items-center">
              <div>
                <h2 className="serif text-2xl text-brand-olive">{currentDiet.month} {currentDiet.year} Plan</h2>
                <p className="text-[10px] text-brand-clay font-bold uppercase tracking-widest">Full Clinical Guide</p>
              </div>
              <button 
                onClick={() => setIsDietExpanded(false)}
                className="p-2 bg-brand-olive text-brand-white rounded-full transition-all"
              >
                <Plus size={20} className="rotate-45" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-10 custom-scrollbar">
              <div className="markdown-content max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentDiet.extractedPlan}</ReactMarkdown>
              </div>
              
              <div className="h-40" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Status Notifications */}
      <AnimatePresence>
        {importStatus && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-6 right-6 z-[70] pointer-events-none flex justify-center"
          >
            <div className={`px-6 py-3 rounded-2xl shadow-xl text-white font-bold text-xs uppercase tracking-widest flex items-center gap-3 ${importStatus.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
              {importStatus.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              {importStatus.message}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-brand-white/95 backdrop-blur-xl border-t border-brand-clay/10 px-4 py-6 flex justify-between items-center z-20">
        <NavButton active={activeTab === 'dash'} onClick={() => setActiveTab('dash')} icon={<TrendingUp size={18} />} label="Stats" />
        <NavButton active={activeTab === 'log'} onClick={() => setActiveTab('log')} icon={<Utensils size={18} />} label="Log" />
        <NavButton active={activeTab === 'exercise'} onClick={() => setActiveTab('exercise')} icon={<Calendar size={18} />} label="Crossfit" />
        <NavButton active={activeTab === 'metrics'} onClick={() => setActiveTab('metrics')} icon={<Scale size={18} />} label="Body" />
        <NavButton active={activeTab === 'advice'} onClick={() => setActiveTab('advice')} icon={<ChefHat size={18} />} label="AI Advisor" />
        <NavButton active={activeTab === 'diet'} onClick={() => setActiveTab('diet')} icon={<FileText size={18} />} label="Plan" />
      </nav>
    </div>
  );
}

function NavButton({ active, icon, onClick, label }: { active: boolean, icon: React.ReactNode, onClick: () => void, label: string }) {
  return (
    <button 
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 transition-all outline-none"
    >
      <div className={`transition-all duration-300 ${active ? 'text-brand-olive scale-110' : 'text-brand-clay/50'}`}>
        {icon}
      </div>
      <div className="relative flex flex-col items-center">
        <span className={`text-[9px] font-bold uppercase tracking-[0.15em] transition-colors ${active ? 'text-brand-ink' : 'text-brand-clay/40'}`}>
          {label}
        </span>
        {active && (
          <motion.div 
            layoutId="activeTab"
            className="w-1 h-1 rounded-full bg-brand-olive absolute -bottom-2.5" 
          />
        )}
      </div>
    </button>
  );
}
