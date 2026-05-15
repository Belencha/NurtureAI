export interface SelectableOption {
  id: string;
  category: string; // e.g. "Breakfast", "Lunch"
  foodName: string;
  description: string;
  nutrients: {
    protein: number;
    carbs: number;
    fat: number;
    calories: number;
  };
}

export interface Diet {
  id: string;
  month: string;
  year: number;
  monthIndex: number; // 0-11
  extractedPlan: string; // The text content extracted from PDF
  selectableOptions?: SelectableOption[]; // Structured list of meal options to pick from
  nutritionalGoals: {
    protein: number;
    carbs: number;
    fat: number;
    calories: number;
  };
  createdAt: number;
}

export interface ExerciseLog {
  id: string;
  date: string; // YYYY-MM-DD
  type: string; // e.g. "CrossFit"
  timestamp: number;
}

export interface FoodLog {
  id: string;
  timestamp: number;
  foodName: string;
  nutrients: {
    protein: number;
    carbs: number;
    fat: number;
    calories: number;
  };
}

export interface DailySummary {
  date: string;
  consumed: {
    protein: number;
    carbs: number;
    fat: number;
    calories: number;
  };
  target: {
    protein: number;
    carbs: number;
    fat: number;
    calories: number;
  };
}

export interface InBodyReport {
  id: string;
  date: string; // YYYY-MM-DD
  weight: number;
  smm: number; // Skeletal Muscle Mass
  pbf: number; // Percentage Body Fat
  bmi: number;
  vfa?: number; // Visceral Fat Area
  createdAt: number;
}
