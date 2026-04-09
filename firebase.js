import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDFyFLD_IZO2WxQiaatsX0FCflWSXc66_4",
  authDomain: "htc-16a4f.firebaseapp.com",
  projectId: "htc-16a4f",
  storageBucket: "htc-16a4f.appspot.com",
  messagingSenderId: "309059583259",
  appId: "1:309059583259:web:d6461faf733f5995e4a7be"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const loginBtn = document.getElementById("loginBtn");

if (loginBtn) {
  loginBtn.addEventListener("click", () => {
    signInWithPopup(auth, provider)
      .then((result) => {
        console.log("Logado:", result.user.displayName);
        window.location.href = "dashboard.html"; // Vai para o dashboard que te mandei antes
      })
      .catch((error) => {
        console.error("Erro:", error.code);
        alert("Erro ao logar. Verifique se o domínio está autorizado no Firebase.");
      });
  });
}
