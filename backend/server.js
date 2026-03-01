require("dotenv").config();

const express = require("express");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

// Root test route
app.get("/", (req, res) => {
  res.send("ART_BAZAAR backend is running 🚀");
});

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

app.post("/create-order", async (req, res) => {
  const { amount } = req.body;

  // FIX: amount is already sent in RUPEES from frontend (checkout.js sends total in rupees)
  // Multiply by 100 here ONCE to convert to paise for Razorpay
  const amountInPaise = Math.round(amount * 100);

  console.log(`Creating order: ₹${amount} = ${amountInPaise} paise`);

  try {
    const order = await razorpay.orders.create({
      amount: amountInPaise,  // NOW correctly in paise
      currency: "INR",
    });

    res.json(order);
  } catch (err) {
    console.error("Razorpay order error:", err);
    res.status(500).json({ error: "Order creation failed", details: err.message });
  }
});

app.post("/verify", (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  const body = razorpay_order_id + "|" + razorpay_payment_id;

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");

  if (expectedSignature === razorpay_signature) {
    res.json({ success: true });
  } else {
    res.status(400).json({ success: false });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
