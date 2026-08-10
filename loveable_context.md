# Lovable Context Prompt: Tri LTB 1v1 Reflex Duel Clash

*Salin semua teks di bawah ini dan tempelkan (paste) ke dalam kolom prompt (chat) Lovable.dev untuk men-generate keseluruhan UI Flow aplikasi Anda.*

---

**PROJECT OVERVIEW**
I am building a web application called "Tri LTB 1v1 Reflex Duel Clash" (Liga Tendang Bola 2026). This is a real-time massive multiplayer tapping game where two schools compete in a "Tug of War" style tapping battle (Kicker vs Goalkeeper). 
The tech stack must be **React components + Tailwind CSS** (Note: the backend uses Vue/Socket.io, so please generate clean, modular React Snippets that I can easily translate or adapt into my Vue framework).

**DESIGN SYSTEM & AESTHETICS (STITCH 5G UI)**
- **Theme:** Dynamic Esports, Cyberpunk Sports, Minimalist, Dark Mode.
- **Colors:** 
  - Background: Extreme Dark Blue/Black (`#050510` or `bg-gray-950`).
  - Team A (Kicker): Tri Magenta (`#FF0066`), with neon glow effects.
  - Team B (Goalie): Tri Cyan (`#00E5FF`), with neon glow effects.
  - Accent/Neutral: Yellow (`#EAB308`), White (`#FFFFFF`).
- **UI Paradigm:** Glassmorphism (`backdrop-blur-md`, `bg-white/5`), oversized cards, chamfered (angled) corners, and high contrast.
- **Typography:** Bold, italicized fonts for numbers and headers (e.g., Inter or Outfit font).
- **Constraints:** NO generated 2D character sprites or illustrations. Use geometric shapes, icons (lucide-react), and typography for visual weight.

---

**APPLICATION FLOW & PAGES TO GENERATE**

Please generate the following screens and components as a complete flow:

### 1. ADMIN CONTROL PANEL (`/admin`)
**Purpose:** For the event operator to manage the live game.
- **Setup Section:** 
  - Dropdown to select "Kategori" (SMA / SMP).
  - Dropdown for "School A (Kicker)" and "School B (Goalie)".
  - Input for "Series City" (e.g., Surabaya).
  - Big CTA Button: "PUBLISH MATCH TO SCREEN".
- **Live Match Section (Hidden until published):**
  - Live preview of School A and School B current Tap Scores (big typography).
  - Button: "START COUNTDOWN (3s)" (Green).
  - Button: "EMERGENCY STOP" (Red).
- **Post-Match Section:**
  - Appears after a match ends.
  - Big Button: "SET SESI PERTANDINGAN BARU (RESET)" (Yellow) to clear the board.

### 2. PLAYER CLIENT - SETUP & WAITING
**Purpose:** Where players join the match.
- **Header:** "REFLEX DUEL" (Glowing text).
- **Input:** A sleek phone number input (placeholder: "0896...").
- **Team Selection Cards (Side-by-side):**
  - Card A: Magenta border, title "KICKER", hover glow.
  - Card B: Cyan border, title "GOALIE", hover glow.
- **Status Text:** If waiting for admin, show pulsing text "MENUNGGU MATCH DARI ADMIN...".

### 3. PLAYER CLIENT - CHARGING (COUNTDOWN)
**Purpose:** 3-second tension builder before the battle.
- **UI:** A massive, full-screen, italicized pulsing number (3... 2... 1...). Text gradient from Magenta to Cyan. Subtitle: "GET READY!".

### 4. PLAYER CLIENT - BATTLE (TUG OF WAR)
**Purpose:** The core gameplay loop.
- **Top Header:** Countdown Timer (e.g., "00:15") and Match City text.
- **Tug of War Progress Bar:** A horizontal bar in the middle of the screen. 
  - Left side fills with Magenta (Team A).
  - Right side fills with Cyan (Team B).
  - A glowing divider in the center that shifts left or right based on the tap ratio.
- **Score Display:** Live tap count numbers for Kicker and Goalie above the bar.
- **Tap Zone:** A massive section taking up the bottom 50% of the screen. Inside is a glowing button "TAP SECEPAT MUNGKIN!". (Must look satisfying to spam tap).

### 5. PLAYER CLIENT - OUTCOME & TWIBBON REDIRECT
**Purpose:** Winner announcement leading to sharing.
- **Outcome Overlay:** 
  - Massive skewed text "GOAL!" or "SELESAI!".
  - Declares the winner (e.g., "KICKER MENANG!").
  - Final score breakdown (School A score vs School B score).
- **Twibbon Customization Page (Redirected state):**
  - **Header:** "Bagikan Kemenanganmu!"
  - **Preview Area:** A square canvas/box representing the Twibbon. Inside, it shows the User's selected School Logo, the final match score, and a placeholder for their uploaded selfie.
  - **Controls:** 
    - "Upload Foto Selfie" (File input styled as a button).
    - "Download Twibbon" (Primary Action).
    - "Share to Instagram" (Secondary Action).

---

**REQUIREMENTS FOR THE AI:**
Build this as a fully navigable prototype. Use state to simulate the transition from Setup -> Charging -> Battle -> Outcome -> Twibbon. Ensure the Tailwind CSS closely matches the "Stitch 5G Cyberpunk" aesthetic described above. Provide all the React components in a clean, modular structure.
