const hourlyRate = document.querySelector("#hourlyRate");
const hoursSaved = document.querySelector("#hoursSaved");
const monthlyPrice = document.querySelector("#monthlyPrice");
const roiOutput = document.querySelector("#roiOutput");

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

function updateRoi() {
  const rate = Number(hourlyRate.value || 0);
  const hours = Number(hoursSaved.value || 0);
  const price = Number(monthlyPrice.value || 0);
  const saved = rate * hours - price;
  roiOutput.value =
    saved >= 0
      ? `${money(saved)} saved per month after subscription`
      : `${money(Math.abs(saved))} more than the estimated monthly savings`;
}

for (const input of [hourlyRate, hoursSaved, monthlyPrice]) {
  input.addEventListener("input", updateRoi);
}

updateRoi();
