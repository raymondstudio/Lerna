const MOCK_ANSWERS: Record<string, string> = {
  "quantum computing": "Quantum computing is a type of computing that uses quantum mechanics (like superposition and entanglement) to process information. While classical computers use bits (0s and 1s), quantum computers use qubits, which can exist in multiple states at once. This allows them to solve complex calculations, like drug discovery or cryptography, exponentially faster.",
  "active and passive transport": "Active transport requires cellular energy (ATP) to move molecules against their concentration gradient (from low to high concentration), like the sodium-potassium pump. Passive transport, however, requires no energy as molecules move along their gradient (from high to low concentration), such as simple diffusion or osmosis.",
  "recursive programming": "Recursive programming is a method where a function calls itself to solve a smaller instance of the same problem. Think of it like a set of nesting Russian dolls: to reach the smallest doll, you must open each larger doll one by one, with a 'base case' that tells the function when to stop opening dolls and return the result.",
  "dna replicate": "DNA replication is the process by which a double-stranded DNA molecule is copied to produce two identical DNA molecules. It occurs in three main steps: unwinding of the double helix by helicase, complementary base pairing by DNA polymerase, and joining of the sugar-phosphate backbone by ligase.",
  "default": "That's an excellent study question! In academic terms, this concept focuses on how structured inputs adapt to dynamic environments. To master this topic, try breaking it down into its core components: define the primary terms, map out their relationships, and look for real-world examples of this system in action."
};

export type MockQuestion = { question: string; options: string[]; correct_answer: string; explanation: string };

export function generateQuestionsFromText(text: string, count: number): MockQuestion[] {
  const sentences = text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 40 && s.length < 200);

  const questions: MockQuestion[] = [];
  const countToGen = Math.min(count, sentences.length);

  const words = text
    .split(/\s+/)
    .map(w => w.replace(/[^a-zA-Z]/g, "").trim())
    .filter(w => w.length > 5 && !["about", "which", "their", "there", "would", "other", "should", "could"].includes(w.toLowerCase()));
  
  const uniqueWords = Array.from(new Set(words));

  for (let i = 0; i < countToGen; i++) {
    const sentence = sentences[i];
    const sentenceWords = sentence.split(/\s+/).map(w => w.replace(/[^a-zA-Z]/g, "")).filter(w => w.length > 5);
    if (sentenceWords.length === 0) continue;
    
    const keyword = sentenceWords.reduce((a, b) => a.length > b.length ? a : b);
    const questionText = sentence.replace(new RegExp(`\\b${keyword}\\b`, "i"), "_______");
    const correctOption = keyword;
    const distractors = uniqueWords
      .filter(w => w.toLowerCase() !== keyword.toLowerCase())
      .slice(0, 3);
    
    while (distractors.length < 3) {
      distractors.push(`Concept ${distractors.length + 1}`);
    }
    
    const options = [correctOption, ...distractors].sort(() => Math.random() - 0.5);

    questions.push({
      question: `Complete the sentence: "${questionText}"`,
      options: options,
      correct_answer: correctOption,
      explanation: `Based on the context: "${sentence}"`
    });
  }

  return questions;
}

export function getMockAnswer(prompt: string, providerName: string = "AI"): string {
  const normalized = prompt.toLowerCase();
  
  if (normalized.includes("quiz generator") || normalized.includes("json") || normalized.includes("correct_answer")) {
    const countMatch = prompt.match(/generate exactly (\d+)/i) || prompt.match(/count = (\d+)/i) || prompt.match(/(\d+) questions/i);
    const count = countMatch ? parseInt(countMatch[1]) : 5;
    
    let textContent = "";
    const docIndex = normalized.indexOf("document context:");
    if (docIndex !== -1) {
      textContent = prompt.slice(docIndex + "document context:".length).trim();
    } else {
      const courseIndex = normalized.indexOf("course:");
      if (courseIndex !== -1) {
        textContent = prompt.slice(courseIndex + "course:".length).trim();
      }
    }
    
    let quizQuestions: MockQuestion[] = [];
    if (textContent.length > 100) {
      quizQuestions = generateQuestionsFromText(textContent, count);
    }
    
    if (quizQuestions.length < count) {
      const generalMock = [
        {
          question: "What is the primary role of active learning in studying?",
          options: ["Passive reading", "Retrieval practice and self-testing", "Highlighting everything", "Listening to lectures only"],
          correct_answer: "Retrieval practice and self-testing",
          explanation: "Active recall forces the brain to retrieve information, strengthening neural pathways."
        },
        {
          question: "Which of these is a key component of the Pomodoro technique?",
          options: ["Study for 5 hours straight", "Take 25-minute breaks", "Work in focused 25-minute intervals", "No breaks allowed"],
          correct_answer: "Work in focused 25-minute intervals",
          explanation: "The Pomodoro technique uses structured intervals (25 mins work, 5 mins break) to maximize focus."
        },
        {
          question: "What does spaced repetition help prevent?",
          options: ["Overstudying", "The forgetting curve", "High exam scores", "Sleep deprivation"],
          correct_answer: "The forgetting curve",
          explanation: "Reviewing material at increasing intervals flattens the forgetting curve, retaining knowledge long-term."
        },
        {
          question: "When taking notes, what is the Cornell method known for?",
          options: ["Using mind maps", "Dividing pages into notes, cues, and summary", "Writing down everything verbatim", "Recording audio only"],
          correct_answer: "Dividing pages into notes, cues, and summary",
          explanation: "The Cornell method uses a systematic format for organizing notes into structured sections."
        },
        {
          question: "What type of memory is strengthened by worked examples?",
          options: ["Short-term memory", "Procedural and conceptual schema", "Sensory memory", "Echoic memory"],
          correct_answer: "Procedural and conceptual schema",
          explanation: "Worked examples demonstrate step-by-step problem solving, building structural understanding."
        }
      ];
      
      while (quizQuestions.length < count) {
        const fallbackQ = generalMock[quizQuestions.length % generalMock.length];
        quizQuestions.push({
          ...fallbackQ,
          question: quizQuestions.length === 0 ? fallbackQ.question : `${fallbackQ.question} (Q${quizQuestions.length + 1})`
        });
      }
    }
    
    return JSON.stringify({ questions: quizQuestions.slice(0, count) });
  }

  // Extract actual user query from transcript to prevent fallback topics
  let userQuery = prompt;
  
  const studentMatches = Array.from(prompt.matchAll(/Student:\s*([^\n]+)/gi));
  if (studentMatches.length > 0) {
    userQuery = studentMatches[studentMatches.length - 1][1].trim();
  } else {
    const courseMatch = prompt.match(/course:\s*([^\n]+)/i);
    if (courseMatch) {
      userQuery = courseMatch[1].trim();
    }
  }

  // Maintain backwards compatibility with E2E tests matching "Offline Simulated Mode"
  const warningLabel = `⚠️ [Offline Simulated Mode - Gemini Key Not Loaded]\n\n`;

  const normalizedQuery = userQuery.toLowerCase();
  for (const key of Object.keys(MOCK_ANSWERS)) {
    if (key !== "default" && normalizedQuery.includes(key)) {
      return warningLabel + MOCK_ANSWERS[key];
    }
  }

  const cleanPrompt = userQuery.replace(/[^a-zA-Z0-9\s]/g, "");
  const words = cleanPrompt.split(/\s+/).filter(w => w.length > 4);
  const subject = words.length > 0 ? words[words.length - 1] : "this topic";

  return warningLabel + 
         `Here is a structured explanation about **${subject}** to help you study:\n\n` +
         `### 1. Core Overview\n` +
         `When analyzing **${subject}**, it is important to first understand its foundational principles. It represents a structured approach to solving academic problems by breaking them down into manageable sub-components.\n\n` +
         `### 2. Key Concepts\n` +
         `- **Integration**: Combining multiple elements of ${subject} to form a cohesive system.\n` +
         `- **Optimization**: Refining the processes involved to improve learning efficiency and accuracy.\n` +
         `- **Contextual Application**: Applying these concepts in real-world exercises and quizzes.\n\n` +
         `### 3. Practice Question\n` +
         `To test your understanding, consider this question: *How does the primary function of ${subject} change when operating in a dynamic environment?*\n\n` +
         `Feel free to ask me to explain any of these points in more detail, or try generating a quiz on this!`;
}
