const addBtn = document.getElementById("addBtn");
const records = document.getElementById("records");

addBtn.addEventListener("click", () => {
  const subject = document.getElementById("subject").value;
  const hours = document.getElementById("hours").value;

  const li = document.createElement("li");
  li.textContent = `${subject} ${hours}時間`;

  records.appendChild(li);
});