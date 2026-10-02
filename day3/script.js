let notes = [
    { id: 1, text: "Buy milk and bread", category: "personal" },
    { id: 2, text: "Finish the Day 3 assignment", category: "study" },
    { id: 3, text: "Email the project report to Grace", category: "work" },
    { id: 4, text: "Revise JavaScript arrays", category: "study" },
    { id: 5, text: "Call mum", category: "personal" },
];

function searchNotes(word) {
    return notes.filter(note =>
        note.text.toLowerCase().includes(word.toLowerCase())
    );
}

console.log(searchNotes("JavaScript")); // Expected: [{ id: 4, text: "Revise JavaScript arrays", category: "study" }]
console.log(searchNotes("pizza")); // Expected: []


function longestNote() {
    if (notes.length === 0) {
        return null;
    }

    let longest = notes[0];

    for (let note of notes) {
        if (note.text.length > longest.text.length) {
            longest = note;
        }
    }

    return longest;
}

console.log(longestNote()); // Expected: { id: 3, text: "Email the project report to Grace", category: "work" }

let savedNotes = notes;
notes = [];
console.log(longestNote()); // Expected: null
notes = savedNotes;


function countByCategory() {
    let counts = {};

    for (let note of notes) {
        if (counts[note.category]) {
            counts[note.category]++;
        } else {
            counts[note.category] = 1;
        }
    }

    return counts;
}

console.log(countByCategory()); // Expected: { personal: 2, study: 2, work: 1 }

let savedNotesForCount = notes;
notes = [];
console.log(countByCategory()); // Expected: {}
notes = savedNotesForCount;


function getSummary() {
    let counts = countByCategory();
    let total = notes.length;

    let noteWord = total === 1 ? "note" : "notes";

    return `${total} ${noteWord}: ${counts.personal || 0} personal, ${counts.work || 0} work, ${counts.study || 0} study.`;
}

console.log(getSummary()); // Expected: "5 notes: 2 personal, 1 work, 2 study."

let savedNotesForSummary = notes;
notes = [];
console.log(getSummary()); // Expected: "0 notes: 0 personal, 0 work, 0 study."
notes = savedNotesForSummary;


function isDuplicate(text) {
    let normalizedText = text.trim().toLowerCase();

    return notes.some(note =>
        note.text.trim().toLowerCase() === normalizedText
    );
}

console.log(isDuplicate("Buy milk and bread")); // Expected: true
console.log(isDuplicate("   BUY MILK AND BREAD   ")); // Expected: true
console.log(isDuplicate("Buy eggs")); // Expected: false


function addNote(text, category) {
    let cleanedText = text.trim();
    let validCategories = ["personal", "work", "study"];

    if (cleanedText.length < 1 || cleanedText.length > 200) {
        console.log("Note must be 1–200 characters.");
        return false;
    }

    if (isDuplicate(cleanedText)) {
        console.log("Note is a duplicate.");
        return false;
    }

    if (!validCategories.includes(category)) {
        console.log("Invalid category.");
        return false;
    }

    let newId = notes.length + 1;

    notes.push({
        id: newId,
        text: cleanedText,
        category: category
    });

    return true;
}

console.log(addNote("Read JavaScript documentation", "study")); // Expected: true
console.log(addNote("Buy milk and bread", "personal")); // Expected: false
console.log(addNote("Something important", "invalid")); // Expected: false
console.log(addNote("", "study")); // Expected: false