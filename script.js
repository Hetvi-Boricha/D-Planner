const addTask = document.querySelector("#addTask");
const inp = document.querySelector(".inputTask");
const deadlineInput = document.querySelector(".deadlineInput");
const pendingList = document.querySelector("#pendingTasks");
const completedList = document.querySelector("#completedTasks");
const alertSound = document.querySelector("#alertSound");
const toast = document.getElementById("toast");
const toastMessage = document.getElementById("toastMessage");
const toastDoneBtn = document.getElementById("toastBtn");
const toastNotYetBtn = document.getElementById("toastSkipBtn");

const summaryPending = document.getElementById("pendingCount");
const summaryCompleted = document.getElementById("completedCount");
const summaryTotal = document.getElementById("totalTasks");

let chart;
let toastTask = null;
let userInteracted = false;

window.addEventListener("click", () => userInteracted = true);

function updateSummary() {
  const total = pendingList.children.length + completedList.children.length;
  const completed = completedList.children.length;
  const pending = pendingList.children.length;

  summaryTotal.textContent = total;
  summaryCompleted.textContent = completed;
  summaryPending.textContent = pending;

  if (!chart) {
    chart = new Chart(document.getElementById("summaryChart"), {
      type: "doughnut",
      data: {
        labels: ["Pending", "Completed"],
        datasets: [{
          data: [pending, completed],
          backgroundColor: ["#f39c12", "#2ecc71"]
        }]
      },
      options: {
        responsive: false,
        plugins: {
          legend: { display: true }
        }
      }
    });
  } else {
    chart.data.datasets[0].data = [pending, completed];
    chart.update();
  }
}


window.addEventListener("load", () => {
  resetTasksIfNewDay();
  restoreTasksFromStorage();
  updateSummary();
});

addTask.addEventListener("click", () => {
  const taskText = inp.value.trim();
  const deadline = deadlineInput.value;
  if (!taskText || !deadline) return;

  const task = createTaskObject(taskText, deadline);
  saveTask(task);
  addTaskToDOM(task);

  inp.value = "";
  deadlineInput.value = "";
  updateSummary();
});

function createTaskObject(text, deadline) {
  return {
    id: Date.now().toString(),
    text,
    deadline,
    createdAt: new Date().toISOString(),
    completed: false
  };
}

function saveTask(task) {
  const tasks = getTasks();
  tasks.push(task);
  localStorage.setItem("tasks", JSON.stringify(tasks));
}

function getTasks() {
  return JSON.parse(localStorage.getItem("tasks") || "[]");
}

function restoreTasksFromStorage() {
  const tasks = getTasks();
  tasks.forEach(addTaskToDOM);
}

function resetTasksIfNewDay() {
  const today = new Date().toDateString();
  const lastOpen = localStorage.getItem("lastOpen");

  if (lastOpen !== today) {
    const tasks = getTasks().map(task => ({ ...task, completed: false }));
    localStorage.setItem("tasks", JSON.stringify(tasks));
    pendingList.innerHTML = "";
    completedList.innerHTML = "";
    restoreTasksFromStorage();
  }
  localStorage.setItem("lastOpen", today);
}

function addTaskToDOM(task) {
  const li = document.createElement("li");
  li.dataset.id = task.id;
  li.dataset.deadline = task.deadline;
  li.dataset.createdAt = task.createdAt;

  const topRow = document.createElement("div");
  topRow.classList.add("topRow");

  const taskSpan = document.createElement("span");
  taskSpan.classList.add("taskText");
  taskSpan.textContent = task.text;
  if (task.completed) taskSpan.classList.add("completed");

  const buttonGroup = document.createElement("div");
  buttonGroup.classList.add("buttonGroup");

  const doneBtn = document.createElement("button");
  doneBtn.textContent = task.completed ? "Undo" : "Done";
  doneBtn.classList.add("done");

  const editBtn = document.createElement("button");
  editBtn.textContent = "Edit";
  editBtn.classList.add("edit");

  const delBtn = document.createElement("button");
  delBtn.textContent = "Delete";
  delBtn.classList.add("delete");

  buttonGroup.append(doneBtn, editBtn, delBtn);
  topRow.append(taskSpan, buttonGroup);

  const timeInfo = document.createElement("div");
  timeInfo.classList.add("timeInfo");
  li.append(topRow, timeInfo);

  const deadlineTime = parseTime(task.deadline);
  const createdAt = new Date(task.createdAt);

  if (!task.completed) {
    const intervalId = setInterval(() => {
      updateTimeDisplay(timeInfo, createdAt, deadlineTime, li);
    }, 1000);
    li.dataset.intervalId = intervalId;
  } else {
    timeInfo.style.display = "none";
  }

  (task.completed ? completedList : pendingList).appendChild(li);
  setTimeout(() => li.classList.add("show"), 10);
}

function updateTimeDisplay(container, createdAt, deadlineTime, li) {
  const now = new Date();
  const secondsPassed = Math.floor((now - createdAt) / 1000);
  const minutes = Math.floor(secondsPassed / 60);
  const seconds = secondsPassed % 60;

  let text = `⏱️ Added ${minutes}m ${seconds}s ago`;
  const diff = deadlineTime - now;

  if (diff > 0) {
    const minsLeft = Math.floor(diff / 60000);
    const secsLeft = Math.floor((diff % 60000) / 1000);
    text += ` | ⌛ Time left: ${minsLeft}m ${secsLeft}s`;
  } else if (secondsPassed > 5) {
    text = `⚠️ Time's up!`;
    container.style.color = "red";

    if (!li.classList.contains("alerted") && userInteracted) {
      li.classList.add("alerted");
      try {
        alertSound.play();
      } catch (err) {
        console.warn("Autoplay blocked:", err);
      }
      toastMessage.textContent = `⏰ "${li.querySelector(".taskText").textContent}" time's up!`;
      toast.classList.remove("hidden");
      toastTask = li;
    }
  }

  container.textContent = text;
}

document.addEventListener("click", (e) => {
  const target = e.target;
  const li = target.closest("li");
  if (!li) return;

  const id = li.dataset.id;
  const taskSpan = li.querySelector(".taskText");

  if (target.classList.contains("delete")) {
    clearInterval(li.dataset.intervalId);
    removeTask(id);
    li.remove();
    updateSummary();
  } else if (target.classList.contains("done")) {
    toggleTaskCompletion(li, id, taskSpan, target);
  } else if (target.classList.contains("edit")) {
    const input = document.createElement("input");
    input.type = "text";
    input.value = taskSpan.textContent;
    taskSpan.replaceWith(input);
    target.textContent = "Save";
    target.classList.replace("edit", "save");
    input.focus();
  } else if (target.classList.contains("save")) {
    const input = li.querySelector("input");
    const newText = input.value.trim();
    if (newText) {
      const span = document.createElement("span");
      span.classList.add("taskText");
      span.textContent = newText;
      input.replaceWith(span);
      target.textContent = "Edit";
      target.classList.replace("save", "edit");

      const tasks = getTasks();
      const index = tasks.findIndex(t => t.id === id);
      if (index !== -1) {
        tasks[index].text = newText;
        localStorage.setItem("tasks", JSON.stringify(tasks));
      }
    }
  }
});
toastDoneBtn.addEventListener("click", () => {
  if (toastTask) {
    const id = toastTask.dataset.id;
    const taskSpan = toastTask.querySelector(".taskText");
    const doneBtn = toastTask.querySelector(".done");

    toggleTaskCompletion(toastTask, id, taskSpan, doneBtn); // ✅ uses the reliable flow

    toast.classList.add("hidden");
    toastTask = null;
    updateSummary();
  }
});


toastNotYetBtn.addEventListener("click", () => {
  toast.classList.add("hidden");
  toastTask = null;
});


function toggleTaskCompletion(li, id, taskSpan, doneBtn) {
  const tasks = getTasks();
  const index = tasks.findIndex(t => t.id === id);
  if (index === -1) return;

  const task = tasks[index];
  const timeInfo = li.querySelector(".timeInfo");
  clearInterval(li.dataset.intervalId);

  const createdAt = new Date(task.createdAt);
  const deadlineTime = parseTime(task.deadline);

  if (task.completed) {
    task.completed = false;
    taskSpan.classList.remove("completed");
    doneBtn.textContent = "Done";
    timeInfo.style.display = "block";

    const intervalId = setInterval(() => {
      updateTimeDisplay(timeInfo, createdAt, deadlineTime, li);
    }, 1000);
    li.dataset.intervalId = intervalId;

    pendingList.appendChild(li);
  } else {
    task.completed = true;
    taskSpan.classList.add("completed");
    doneBtn.textContent = "Undo";
    timeInfo.style.display = "none";

    completedList.appendChild(li);
  }

  tasks[index] = task;
  localStorage.setItem("tasks", JSON.stringify(tasks));
  updateSummary();
}

function removeTask(id) {
  const tasks = getTasks().filter(t => t.id !== id);
  localStorage.setItem("tasks", JSON.stringify(tasks));
  updateSummary();
}

function parseTime(timeStr) {
  const [h, m] = timeStr.split(":");
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

setInterval(updateSummary, 60000);
