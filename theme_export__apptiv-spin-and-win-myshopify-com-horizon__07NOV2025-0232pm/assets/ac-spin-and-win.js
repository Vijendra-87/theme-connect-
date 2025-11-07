
document.addEventListener("DOMContentLoaded", () => {
  const root = document.querySelector("#spin-win-root");
  if (!root) return;

  const metafieldJSON = globalFieldsReward.spin_wheel_rewards;
  const customer = globalFieldsReward.customer;
  let config = {};
  try {
    config = metafieldJSON;
  } catch {
    console.warn("Invalid spin_wheel metafield JSON");
    return;
  }

  if (config.status !== "active" || !Array.isArray(config.rules)) return;

  const activeRules = config.rules
    .filter(r => r.status === "active" && isDateActive(r))
    .sort((a, b) => (a.priority || 99) - (b.priority || 99));

  const rule = getApplicableRule(activeRules, customer);
  if (!rule) return;

  const spinKey = getSpinKey(rule, customer);
  const spinData = JSON.parse(localStorage.getItem(spinKey) || "{}");

  // Create popup
  const popup = document.createElement("div");
  popup.id = "spin-win-popup";
  popup.classList.add("active");
  popup.innerHTML = `
    <div class="spin-win-container">
           <div class="headre" >
          <h3 >Spin To Win</h3>
          <p style="margin: 0px;font-size: 15px;padding: 0px;">Spin the wheel to grab exclusive assured rewards</p>
        </div>
      <button class="spin-win-close">&times;</button>
      <div class="spin-wheel-wrap">
        <canvas id="spin-wheel"></canvas>
        <div class="spin-pointer"></div>
      </div>
        <div class="step step-1 active">
        <h3 style="margin-top: 0px;margin-bottom: 0px;">Win a discount!</h3>
        <p style="margin-top: 0px;margin-bottom: 0px;">Enter your email for a chance to spin</p>

        <div class="input-buuton" style="gap: 10px;margin-top: 12px;display: flex;">
        ${rule.require_email ? '<input type="email" id="spin-email" placeholder="Enter your email">' : ""}
        <button class="spin-win-btn" id="spin-btn">Spin!</button>

        </div>
        <span id="email-error"></span>
        <br>

        <a href="#" id="no-thanks">No Thanks</a>

          </div>
          <div class="step step-2 ">
            <h3 style="margin-top: 0px;margin-bottom: 0px;">You Win!</h3>
            <p style="margin-top: 0px;margin-bottom: 0px;">Here’s your discount code</p>
            <strong id="discount-text" style="margin-bottom: 0px;margin-top: 0px;"></strong>
          <div class="copy-code-section" style="margin-top: 10px;gap: 10px;display: flex;">
            <input id="discount-code" value="" readonly="">
            <button class="spin-btn" id="copy-code">Copy Code</button>
          </div>
            <br>
           <span style="color: #3c64ab;">Apply this code at checkout</span>
          </div>
      <div class="spin-result"></div>
    </div>`;
  document.body.appendChild(popup);
 
  const canvas = popup.querySelector("#spin-wheel");
  const ctx = canvas.getContext("2d");
  const btn = popup.querySelector(".spin-win-btn");
  const discountCode = popup.querySelector("#discount-code");
  const discountText = popup.querySelector("#discount-text");
  const steps = document.querySelectorAll(".step");
  const closeBtn = popup.querySelector(".spin-win-close");
  const noThanks = popup.querySelector("#no-thanks");
  const emailInput = popup.querySelector("#spin-email");
 showStep(1 )//when page load show the spin button
  closeBtn.addEventListener("click", () => popup.classList.remove("active"));
  noThanks.addEventListener("click", () => popup.classList.remove("active"));

  drawWheel(canvas, ctx, rule.rewards);

  let currentRotation = 0;
  let isSpinning = false;

  btn.addEventListener("click", () => {
    const existing = JSON.parse(localStorage.getItem(spinKey) || "{}");
    const spinsUsed = existing.count || 0;
debugger
    // If reached max spins, block further spins
    if (spinsUsed >= (rule.max_spins || 1)) {
      showStep(2)//to show reward 
      discountText.textContent = `You already won: ${existing.reward}`;
      discountCode.value = `${existing.discountCode}`;
      return;
    }

    if (isSpinning) return;
    let email = emailInput ? emailInput.value.trim() : "";
    if (rule.require_email && !email) {
      alert("Please enter your email");
      return;
    }

    const reward = getWeightedReward(rule.rewards);
    const count = rule.rewards.length;
    const sliceAngle = 360 / count;
    const sliceIndex = rule.rewards.findIndex(r => r.DiscountCode === reward);
    const stopAngle = 360 - (sliceIndex * sliceAngle + sliceAngle / 2);
    const DiscountCodeForWheel = rule.rewards[sliceIndex]?.DiscountCode
    const fullSpins = 5;
    const finalAngle = fullSpins * 360 + stopAngle;
    const duration = 4000;

    isSpinning = true;

    const start = performance.now();

    const animate = (time) => {
      const progress = Math.min((time - start) / duration, 1);
      const eased = easeOutCubic(progress);
      const angle = currentRotation + eased * (finalAngle - currentRotation);
      canvas.style.transform = `rotate(${angle}deg)`;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
         showStep(2)//to show reward 
        currentRotation = angle % 360;
        //resultEl.textContent = `🎉 You won: ${reward}!`;
        discountText.textContent = `🎉 You won: ${reward}`;
        discountCode.value = `${DiscountCodeForWheel}`;
        localStorage.setItem(spinKey, JSON.stringify({
          reward,
          DiscountCode:DiscountCodeForWheel ,
          count: spinsUsed + 1,
          email,
        }));
        isSpinning = false;
      }
    };

    requestAnimationFrame(animate);
  });

  // === Helper functions ===
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function isDateActive(rule) {
    const now = new Date();
    const start = new Date(rule.start_date);
    const end = new Date(rule.end_date);
    return now >= start && now <= end;
  }

  function getApplicableRule(rules, customer) {
    for (const r of rules) {
      if (r.type === "customer") {
        const tagMatch = (r.customer_tags || []).some(tag => (customer.customerTags || []).includes(tag));
        const idMatch = (r.customer_ids || []).includes(customer.customerId);
        if (tagMatch || idMatch) return r;
      }
    }
    return rules.find(r => r.type === "universal") || null;
  }

  function getSpinKey(rule, customer) {
    return `spin_result_${rule.id}_${customer.customerId || "guest"}`;
  }

  function getWeightedReward(rewards) {
    const total = rewards.reduce((sum, r) => sum + r.probability, 0);

    // If all probabilities are zero, pick random reward
    if (total <= 0) {
      const randomReward = rewards[Math.floor(Math.random() * rewards.length)];
      return randomReward.DiscountCode;
    }

    let rand = Math.random() * total;
    for (const r of rewards) {
      if (r.probability === 0) continue;
      rand -= r.probability;
      if (rand <= 0) return r.DiscountCode;
    }

    return rewards[Math.floor(Math.random() * rewards.length)].DiscountCode;
  }

  function drawWheel(canvas, ctx, rewards) {
    const count = rewards.length;
    const size = Math.min(260, window.innerWidth * 0.8);
    canvas.width = canvas.height = size;
    const radius = size / 2;
    const angle = (2 * Math.PI) / count;
    const colors = ["#1263f3","#cac9c9"];

rewards.forEach((reward, i) => {
  const start = i * angle;
  ctx.beginPath();
  ctx.moveTo(radius, radius);
  ctx.arc(radius, radius, radius, start, start + angle);
  ctx.closePath();

  // Fill slice
  ctx.fillStyle = colors[i % colors.length];
  ctx.fill();

  // Add border line between slices
  // ctx.lineWidth = 2;
  // ctx.strokeStyle = "#000000"; // You can change this to #000 or any border color
  // ctx.stroke();

  // Add label text
  ctx.save();
  ctx.translate(radius, radius);
  ctx.rotate(start + angle / 2);
  ctx.textAlign = "right";
  ctx.fillStyle = "#fff";
  ctx.font = `bold ${Math.max(10, radius / 10)}px sans-serif`;
  ctx.fillText(reward.label, radius - 10, 5);
  ctx.restore();
});


  }

    // Step control
  function showStep(num){
    steps.forEach(s => s.classList.remove("active"));
    steps[num-1].classList.add("active");
  }
  const copyBtn = document.getElementById('copy-code');
  const discountInput = document.getElementById('discount-code');

copyBtn.addEventListener('click', () => {
    // Select the input text
    discountInput.select();
    discountInput.setSelectionRange(0, 99999); // For mobile

    // Copy to clipboard
    navigator.clipboard.writeText(discountInput.value)
        .then(() => {
            // Show success feedback
            copyBtn.textContent = "Copied!";
            
            // Move to next step after 2 seconds
            setTimeout(() => {
                copyBtn.textContent = "Copy Code";
                document.getElementById("spin-win-popup").style.display="none";
            }, 1000);
        })
        .catch(err => {
            console.error('Failed to copy: ', err);
        });
});


});
