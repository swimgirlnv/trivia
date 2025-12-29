export type Question = {
  id: string;
  prompt: string;
  unit?: string;
  answer: number;
  botRange: [number, number];
};

export const QUESTIONS: Question[] = [
  {
    id: "q1",
    prompt: "How many seconds are there in a day?",
    unit: "seconds",
    answer: 86400,
    botRange: [70000, 110000],
  },
  {
    id: "q2",
    prompt: "In what year was the first iPhone released?",
    unit: "year",
    answer: 2007,
    botRange: [1998, 2014],
  },
  {
    id: "q3",
    prompt: "What is the height of Mount Everest in meters?",
    unit: "meters",
    answer: 8848,
    botRange: [7000, 10000],
  },
  {
    id: "q4",
    prompt: "How many bones are in the adult human body?",
    unit: "bones",
    answer: 206,
    botRange: [150, 260],
  },
  {
    id: "q5",
    prompt: "What is the population of Iceland (approx, in 2023)?",
    unit: "people",
    answer: 387000,
    botRange: [200000, 600000],
  },
  {
    id: "q6",
    prompt: "How many minutes does light take to travel from the Sun to Earth?",
    unit: "minutes",
    answer: 8,
    botRange: [5, 12],
  },
  {
    id: "q7",
    prompt: "How many US states border the Pacific Ocean?",
    unit: "states",
    answer: 5,
    botRange: [2, 8],
  },
  {
    id: "q8",
    prompt: "What is the boiling point of water in Celsius at sea level?",
    unit: "°C",
    answer: 100,
    botRange: [70, 120],
  },
  {
    id: "q9",
    prompt: "How many keys are on a standard modern piano?",
    unit: "keys",
    answer: 88,
    botRange: [60, 110],
  },
  {
    id: "q10",
    prompt: "What is the diameter of Earth in kilometers (approx)?",
    unit: "km",
    answer: 12742,
    botRange: [8000, 16000],
  },

  // --- More questions (q11-q60) ---

  { id: "q11", prompt: "How many minutes are in a week?", unit: "minutes", answer: 10080, botRange: [6000, 14000] },
  { id: "q12", prompt: "How many planets are in the Solar System?", unit: "planets", answer: 8, botRange: [6, 12] },
  { id: "q13", prompt: "How many bones are in the human spine (approx)?", unit: "bones", answer: 33, botRange: [20, 45] },
  { id: "q14", prompt: "How many elements are on the periodic table (currently)?", unit: "elements", answer: 118, botRange: [90, 140] },
  { id: "q15", prompt: "How many players are on the field for one soccer team?", unit: "players", answer: 11, botRange: [7, 15] },
  { id: "q16", prompt: "How many players are on the court for one basketball team?", unit: "players", answer: 5, botRange: [3, 8] },
  { id: "q17", prompt: "How many squares are on a chessboard?", unit: "squares", answer: 64, botRange: [40, 90] },
  { id: "q18", prompt: "In what year did Apollo 11 land on the Moon?", unit: "year", answer: 1969, botRange: [1955, 1985] },
  { id: "q19", prompt: "How many strings does a standard guitar have?", unit: "strings", answer: 6, botRange: [4, 12] },
  { id: "q20", prompt: "How many cards are in a standard deck (no jokers)?", unit: "cards", answer: 52, botRange: [30, 70] },

  { id: "q21", prompt: "How many hours are in a leap year?", unit: "hours", answer: 8784, botRange: [8000, 9500] },
  { id: "q22", prompt: "What is the freezing point of water in Celsius?", unit: "°C", answer: 0, botRange: [-30, 30] },
  { id: "q23", prompt: "How many centimeters are in a meter?", unit: "cm", answer: 100, botRange: [50, 200] },
  { id: "q24", prompt: "How many millimeters are in an inch?", unit: "mm", answer: 25, botRange: [10, 50] },
  { id: "q25", prompt: "How many US Senators are there total?", unit: "senators", answer: 100, botRange: [60, 140] },
  { id: "q26", prompt: "How many stripes are on the US flag?", unit: "stripes", answer: 13, botRange: [5, 20] },
  { id: "q27", prompt: "How many stars are on the US flag?", unit: "stars", answer: 50, botRange: [40, 60] },
  { id: "q28", prompt: "How many days does it take for Earth to orbit the Sun (approx)?", unit: "days", answer: 365, botRange: [300, 430] },
  { id: "q29", prompt: "How many minutes are in a day?", unit: "minutes", answer: 1440, botRange: [1000, 2000] },
  { id: "q30", prompt: "How many seconds are in an hour?", unit: "seconds", answer: 3600, botRange: [2000, 6000] },

  { id: "q31", prompt: "What is the speed of sound in air at sea level (approx) in m/s?", unit: "m/s", answer: 343, botRange: [250, 500] },
  { id: "q32", prompt: "How far is the Moon from Earth (average) in kilometers?", unit: "km", answer: 384400, botRange: [200000, 600000] },
  { id: "q33", prompt: "How many moons does Mars have?", unit: "moons", answer: 2, botRange: [0, 6] },
  { id: "q34", prompt: "How many teeth does an adult human typically have?", unit: "teeth", answer: 32, botRange: [20, 40] },
  { id: "q35", prompt: "How many bytes are in a kilobyte (computer science, base-2)?", unit: "bytes", answer: 1024, botRange: [900, 2000] },
  { id: "q36", prompt: "How many bits are in a byte?", unit: "bits", answer: 8, botRange: [4, 16] },
  { id: "q37", prompt: "How many degrees are in a circle?", unit: "degrees", answer: 360, botRange: [180, 720] },
  { id: "q38", prompt: "How many points is a touchdown worth (NFL, excluding extra points)?", unit: "points", answer: 6, botRange: [3, 10] },
  { id: "q39", prompt: "How many yards is a football field (goal line to goal line)?", unit: "yards", answer: 100, botRange: [70, 150] },
  { id: "q40", prompt: "How long is an Olympic swimming pool?", unit: "meters", answer: 50, botRange: [25, 100] },

  { id: "q41", prompt: "In what year did World War II end?", unit: "year", answer: 1945, botRange: [1930, 1960] },
  { id: "q42", prompt: "In what year did the Titanic sink?", unit: "year", answer: 1912, botRange: [1880, 1940] },
  { id: "q43", prompt: "How many liters are in a US gallon (approx)?", unit: "liters", answer: 4, botRange: [2, 8] },
  { id: "q44", prompt: "How many centimeters are in an inch (approx)?", unit: "cm", answer: 2.54 as unknown as number, botRange: [1, 5] }, // if you prefer integers only, set answer to 3 and make it “approx”
  { id: "q45", prompt: "How many minutes is a standard NHL period?", unit: "minutes", answer: 20, botRange: [10, 30] },
  { id: "q46", prompt: "How many innings are in a standard MLB baseball game?", unit: "innings", answer: 9, botRange: [6, 12] },
  { id: "q47", prompt: "How many holes are in a standard round of golf?", unit: "holes", answer: 18, botRange: [9, 36] },
  { id: "q48", prompt: "How many grams are in a kilogram?", unit: "grams", answer: 1000, botRange: [500, 2000] },
  { id: "q49", prompt: "How many meters are in a kilometer?", unit: "meters", answer: 1000, botRange: [500, 2000] },
  { id: "q50", prompt: "How many seconds are in a minute?", unit: "seconds", answer: 60, botRange: [30, 120] },

  { id: "q51", prompt: "What is the radius of Earth in kilometers (approx)?", unit: "km", answer: 6371, botRange: [4000, 9000] },
  { id: "q52", prompt: "What is the length of the Amazon River in kilometers (approx)?", unit: "km", answer: 6400, botRange: [3000, 9000] },
  { id: "q53", prompt: "How many bones are in a human hand (including wrist/carpals)?", unit: "bones", answer: 27, botRange: [15, 35] },
  { id: "q54", prompt: "How many sides does a hexagon have?", unit: "sides", answer: 6, botRange: [3, 10] },
  { id: "q55", prompt: "How many countries are in the European Union (as of 2025)?", unit: "countries", answer: 27, botRange: [20, 35] },
  { id: "q56", prompt: "How many countries are there in the world (UN members)?", unit: "countries", answer: 193, botRange: [150, 220] },
  { id: "q57", prompt: "How many piano keys are white keys?", unit: "keys", answer: 52, botRange: [40, 60] },
  { id: "q58", prompt: "How many continents are there?", unit: "continents", answer: 7, botRange: [5, 10] },
  { id: "q59", prompt: "How many dots are on a standard pair of dice (sum of pips)?", unit: "dots", answer: 42, botRange: [20, 70] },
  { id: "q60", prompt: "How many degrees Celsius is normal human body temperature (approx)?", unit: "°C", answer: 37, botRange: [30, 42] },
];

// Utility function to shuffle questions
export function getShuffledQuestions(): Question[] {
  const arr = [...QUESTIONS];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Add a few more fun questions
QUESTIONS.push(
  { id: "q61", prompt: "How many colors are there in a rainbow?", unit: "colors", answer: 7, botRange: [5, 10] },
  { id: "q62", prompt: "How many hearts does an octopus have?", unit: "hearts", answer: 3, botRange: [1, 6] },
  { id: "q63", prompt: "How many time zones are there in Russia?", unit: "time zones", answer: 11, botRange: [7, 15] },
  { id: "q64", prompt: "How many squares are there on a Rubik's Cube (one face)?", unit: "squares", answer: 9, botRange: [6, 20] },
  { id: "q65", prompt: "How many Olympic rings are there?", unit: "rings", answer: 5, botRange: [3, 8] }
);