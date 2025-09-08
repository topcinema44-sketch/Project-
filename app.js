// Firebase config (punyamu)
const firebaseConfig = {
  apiKey: "AIzaSyDdlvPMWThdEUk2D92Tg_mQSHbGO4LG2AE",
  authDomain: "nusa-7a52a.firebaseapp.com",
  databaseURL: "https://nusa-7a52a-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "nusa-7a52a",
  storageBucket: "nusa-7a52a.firebasestorage.app",
  messagingSenderId: "72016839114",
  appId: "1:72016839114:web:0bc8978a826619f7ad8f33",
  measurementId: "G-HBZN4WGKWX"
};

// Inisialisasi Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

// Helper: ganti halaman
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// Splash otomatis pindah ke auth
setTimeout(() => showPage("auth"), 2000);

// Register
async function register() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  try {
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;

    // Data awal user di DB
    await db.ref("users/" + user.uid).set({
      email: user.email,
      saldo: 0,
      limits: { menghasilkan: 20, xstra_bonus: 20, super_bonus: 15 },
      lastReset: new Date().toISOString(),
      cooldowns: { menghasilkan: 0, xstra_bonus: 0, super_bonus: 0 }
    });

    alert("Registrasi berhasil!");
    showPage("warning");
  } catch (err) {
    alert("❌ " + err.message);
  }
}

// Login
async function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  try {
    await auth.signInWithEmailAndPassword(email, password);
    alert("Login berhasil!");
    showPage("warning");
  } catch (err) {
    alert("❌ " + err.message);
  }
}

// Logout
async function logout() {
  await auth.signOut();
  showPage("auth");
}

// Reward button
const rewardBtn = document.getElementById("rewardBtn");
rewardBtn.addEventListener("click", async () => {
  let sec = 5;
  rewardBtn.disabled = true;
  rewardBtn.innerText = `Tunggu ${sec}s`;

  const timer = setInterval(() => {
    sec--;
    rewardBtn.innerText = `Tunggu ${sec}s`;
    if (sec <= 0) {
      clearInterval(timer);
      rewardBtn.disabled = false;
      rewardBtn.innerText = "Terima Reward";
    }
  }, 1000);

  const user = auth.currentUser;
  if (!user) return;

  const userRef = db.ref("users/" + user.uid);
  const snap = await userRef.get();

  let saldo = 0;
  if (snap.exists()) {
    saldo = snap.val().saldo || 0;
  }

  saldo += 1000;
  await userRef.update({ saldo });
  document.getElementById("saldo").innerText = saldo;
  alert("Reward +1000");
});