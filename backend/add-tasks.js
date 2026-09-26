const db = require("./db");

const tasks = [
  "Learning new skills becomes easier when practice is regular.\nCareful typing helps reduce mistakes during digital work.\nFocus on accuracy before trying to increase speed.",

  "A clear workspace can make computer tasks more comfortable.\nOrganized information is easier to find and manage.\nGood habits can improve productivity over time.",

  "Typing is a useful skill for many online activities.\nCorrect spelling makes written information easier to understand.\nReview your work before submitting each task.",

  "Good time management helps people complete tasks efficiently.\nBreaking larger tasks into smaller steps can be useful.\nConsistent progress is better than rushing.",

  "Digital communication depends on clear written information.\nAccurate typing helps keep messages easy to understand.\nAlways check important text before submitting it.",

  "Regular practice can improve familiarity with a keyboard.\nKeeping your attention on the text helps maintain accuracy.\nTake your time when completing a new typing task.",

  "Computers are useful tools for learning and communication.\nMany digital jobs require careful written input.\nAccuracy is an important part of reliable work.",

  "Reading the complete instruction can prevent simple mistakes.\nTyping exactly what is shown requires concentration.\nCheck each line before submitting the task.",

  "Good writing communicates information in a clear manner.\nTyping carefully helps preserve the original meaning.\nSmall corrections can improve the quality of written work.",

  "Practice can make familiar tasks easier over time.\nA steady typing rhythm can help maintain accuracy.\nAvoid skipping words when copying text.",

  "Online work often requires attention to written details.\nAccurate information is valuable in digital systems.\nCareful review can prevent unnecessary errors.",

  "Learning requires patience and repeated practice.\nTyping exercises can help develop useful computer skills.\nFocus on completing each task correctly.",

  "Clear instructions help people complete digital tasks properly.\nReading before typing can reduce avoidable mistakes.\nAccuracy should remain the main priority.",

  "A keyboard provides many ways to enter information quickly.\nGood typing habits can make computer work easier.\nPractice regularly to become more familiar with the keys.",

  "Written information should be checked before submission.\nCorrect punctuation can make sentences easier to read.\nCareful typing produces more reliable results.",

  "Technology continues to change the way people work.\nDigital skills can be useful in many different situations.\nLearning gradually can build confidence and accuracy.",

  "Concentration is helpful when copying longer sentences.\nRead each line carefully before entering the text.\nVerify your answer before submitting the task.",

  "Good organization makes repeated work easier to manage.\nKeeping information accurate is important for digital tasks.\nCareful attention can improve overall results.",

  "Typing practice can help improve familiarity with common words.\nReading while typing can help maintain the correct sequence.\nAlways compare your work with the original text.",

  "Reliable work begins with understanding the assigned task.\nFollow the instructions carefully from beginning to end.\nSubmit the completed work only after checking it.",

  "Digital platforms depend on accurate information from users.\nCareful typing helps maintain the quality of that information.\nReview the final text before completing the task.",

  "Small improvements can become noticeable with regular practice.\nConsistent attention helps reduce typing errors.\nComplete every sentence before submitting your work."
];

const insert = db.prepare(`
  INSERT INTO typing_tasks (task_text, reward, active)
  SELECT ?, 2, 1
  WHERE NOT EXISTS (
    SELECT 1 FROM typing_tasks WHERE task_text = ?
  )
`);

const addTasks = db.transaction(() => {
  for (const task of tasks) {
    insert.run(task, task);
  }
});

addTasks();

const count = db.prepare(`
  SELECT COUNT(*) AS total
  FROM typing_tasks
  WHERE active = 1
`).get();

console.log(`Active typing tasks: ${count.total}`);

db.close();
