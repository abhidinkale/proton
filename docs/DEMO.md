# The 3-Minute Demo — one patient, one clinic, one database

**Goal:** prove the closed loop is real, not choreographed. The phone writes to
Postgres, the clinic reads the same rows, the clinic writes back, the phone pulls
it. No relay, no mirror, no mock.

**Setup:** patient on the phone, clinic on the laptop (mirror it to a TV if there
is one). The laptop runs the clinician web app; the phone runs the debug APK.

---

## 1. What is actually happening

| On stage | Behind it |
| --- | --- |
| A booking made in airplane mode | A row in the phone's outbox (`DorkStore`), then `POST /api/patient/sync/bookings` |
| The appointment appearing on the laptop | `GET /api/clinic/live/overview`, polling every 3 s, reading `appointments` |
| Confirm | `POST /api/clinic/live/appointments/:id/confirm` sets `confirmed_at` |
| The phone showing "Confirmed" | `GET /api/patient/sync/pull` derives `status: "CONFIRMED"` from that column |
| A check-in becoming "Needs attention" | `POST /api/patient/sync/follow-ups`, read by the attention projection |
| A reply appearing in "From your clinic" | `POST /api/clinic/live/messages` → the next pull |

Both halves are the same database. That is the whole claim.

---

## 2. Pre-flight (do this 15 minutes before, not on stage)

### 2.1 Database

```bash
brew services start postgresql@16
createdb proton_demo            # once only
```

In `apps/api/.env`:

```ini
DATABASE_URL=postgres://localhost:5432/proton_demo
PROTON_SYNTHETIC_MODE=true      # only for the demo machine
OTP_DELIVERY=simulated          # or `email` if a Brevo key is configured
```

### 2.2 Seed the clinic

```bash
cd apps/api
npm run demo:seed
```

It prints the clinic code, the clinician login and the two patient emails.
Write the clinic code down — it is the only thing you have to type on stage
that you cannot copy/paste.

Expected output:

```
Clinic            Beacon Hill Family Health
Clinician login   dr.lin@proton.health / valid_password_2026!
Clinic code       XXXXXX
Patients          clara.nguyen@example.com, marcus.reed@example.com
```

### 2.3 Start the API and the clinic console

```bash
# terminal 1
cd apps/api && npm run dev          # http://localhost:3002

# terminal 2
cd apps/web && npm run dev          # http://localhost:3001
```

Open `http://localhost:3001`, log in as `dr.lin@proton.health` /
`valid_password_2026!`, then go to **Care Loop** in the sidebar.

You should see **2 on the schedule**, **1 awaiting confirmation**, and **1 needs
attention** (Marcus's routine refill request — it gives the severity sort
something to sort against later).

### 2.4 Connect the phone (USB — the reliable path)

```bash
adb devices                        # must show one device, "device" not "unauthorized"
adb reverse tcp:3002 tcp:3002
```

`adb reverse` means the phone reaches the laptop's API at `http://localhost:3002`
with no Wi-Fi, no tunnel and no certificate. Keep the cable connected during the
demo; it also keeps the battery up.

### 2.5 Sign the phone in once

On the phone:

1. **Profile → My clinic → Set up sync**
2. Switch **Sync with my clinic** on
3. Server address: `http://localhost:3002`
4. Clinic code: the code printed by `demo:seed`
5. Email: `clara.nguyen@example.com`
6. Tap **Send one-time code**
7. In synthetic mode the screen shows **“Demo sign-in code: 123456”** — type it
   in and tap **Verify and connect**

The session lasts 30 days, so this survives every rehearsal and the demo day.
Confirm the phone shows **Last sync** with a recent time.

> **If you switched `OTP_DELIVERY=email`:** the code arrives at the inbox for
> `clara.nguyen@example.com` instead, and the app says “code sent to
> c\*\*\*@example.com”. Make sure `/health/email` reports `ok` first:
> `curl -s localhost:3002/health/email | jq`

### 2.6 Final checks

- [ ] Laptop: Care Loop shows both upcoming appointments and the refill request
- [ ] Phone: Profile → My clinic shows the clinic name and a recent sync
- [ ] Phone: Care screen shows Clara's appointment under **Your appointments**
- [ ] Phone: Care screen shows a completed visit two days ago under **After your
      last visits**, with **Answer check-in**
- [ ] Laptop: `curl -s localhost:3002/health | jq .workflow` prints `"postgres"`
- [ ] Phone: cellular data **off**, Wi-Fi **off** (you will turn it back on in beat 4)
- [ ] Laptop: notifications silenced, browser zoom at 100%, one tab only

---

## 3. The script (3 minutes)

### Beat 1 — "She books with no signal" (phone, 40 s)

1. Phone: **Care → Book appointment**
2. Pick any slot, reason **"Sore throat"**, tap **Confirm**
3. Hold the phone up so the room can see the airplane icon

> “There is no network on this phone. The booking is on the device, not on a
> server somewhere pretending to be a clinic. Watch the laptop — it is
> genuinely empty of this visit.”

### Beat 2 — "The clinic sees nothing yet" (laptop, 15 s)

Point at Care Loop. Clara's seeded appointment, Marcus's appointment and the
refill request are there; the new "Sore throat" booking is not.

> “This is the same clinic console a real front desk would use. Right now it
> has no idea that booking exists — because it doesn't. That is the honest
> state.”

### Beat 3 — "Signal comes back" (phone, 20 s)

1. Turn airplane mode off
2. Leave the app in the foreground

The outbox drains immediately. On the laptop, **within 3 seconds** the new
appointment appears with the patient's name, reason and "Awaiting confirmation".

> “One request went out. The clinic's poll picked it up. Nothing was
> re-keyed.”

### Beat 4 — "Reception confirms" (laptop, 20 s)

1. Click **Confirm** on the new appointment
2. The badge flips to **Confirmed**

> “That wrote one column — `confirmed_at` — on one row.”

Then pick up the phone (it polls every 15 s while open) and show the visit card.

> “The phone's next pull sees the same confirmation. There is no second copy to
> drift out of sync.”

### Beat 5 — "She says it got worse" (phone, 30 s)

1. Phone: **Care → After your last visits → Answer check-in** on the visit from
   two days ago
2. Choose **Worse**, tick **side effects**, tick **needs to be seen**
3. Submit

On the laptop, **Needs attention** gains a **critical** card within 3 seconds,
above the routine refill request.

> “The queue is sorted by clinical urgency, not by arrival. A patient asking to
> be seen never sits below a refill request.”

### Beat 6 — "The doctor answers" (laptop → phone, 45 s)

1. Laptop: **Open & reply** on the critical card
2. Type: *“Come in at 4pm today and we'll listen to your chest. If your
   breathing gets worse before then, call us right away.”*
3. **Send reply**
4. Pick up the phone. Within 15 seconds the Care screen shows **“From your
   clinic — 1 new message”**

Open it. Show the message, the doctor's name and the time.

> “That message is the row the doctor just wrote. The phone didn't get a push
> notification from a demo server — it pulled the clinic's own record.”

### Close (15 s)

> “Two clients, one Postgres database, no glue in between. That is the entire
> product: a patient app that works offline, and a clinic console that sees the
> truth the moment the phone can reach it. The pilot is 1,000 patients across 50
> clinics for three months on free tiers — the software is the hard part, and
> it's done.”

---

## 4. Between rehearsals

Reset to a clean state — two upcoming appointments, one completed visit, one
refill request:

```bash
cd apps/api
npm run demo:reset
```

It deletes only `pat-demo-*` rows and the labelled demo code, then reseeds. It
prints a **new clinic code**. The phone **keeps its session** — reset does not
revoke patient sessions, so you can reset between rehearsals and leave the demo
phone signed in. Only the one-time codes are invalidated, which is what makes
the new printed code the live one.

On the phone, to wipe local state as well: **Profile → Erase all data**, then
sign in again with the current clinic code.

---

## 5. If something breaks on stage

| Symptom | Cause | Recovery |
| --- | --- | --- |
| Laptop shows “The live loop needs PostgreSQL” | API started without `DATABASE_URL` | Restart the API with the variable set; no need to reseed |
| Laptop shows "clinic link is interrupted" | API not running, or wrong port | `curl localhost:3002/health`; restart `npm run dev` |
| Booking never appears after reconnect | `adb reverse` lost (cable pulled) | Replug, `adb reverse tcp:3002 tcp:3002`, tap **Sync now** in the app |
| Phone says "Unauthorized" / "session expired" | `demo:reset` does not revoke sessions, so this means the 30-day token really aged out, or the database was recreated | Sign in again with the current clinic code (Profile → My clinic → Set up sync) |
| Phone can't reach `http://localhost:3002` | USB debugging revoked | `adb devices`; accept the prompt on the phone |
| No code shown in simulated mode | API is in `email` mode without a key | Check `/health/email`; either add the Brevo key or set `OTP_DELIVERY=simulated` |
| Laptop shows stale data | Browser tab asleep | Click **Refresh**; the poll resumes on focus |

**Wi-Fi fallback (no cable).** Install `cloudflared`, then:

```bash
cloudflared tunnel --url http://localhost:3002
```

Use the printed `https://…trycloudflare.com` address as the phone's server
address. This is a real HTTPS URL, so it also works on a release build. It needs
internet on both machines, which is exactly what the USB path avoids.

---

## 6. What this demo does **not** claim

- The patients are **synthetic**. No real PHI is in this database, and the free
  tiers have no BAA. Say so if asked; it is the correct answer, not a weakness.
- Email delivery is **one code per sign-in**, not a marketing channel. Brevo's
  free tier is 300/day, which covers ~1,000 monthly re-auths but not daily
  logins — the app's 30-day session is what makes the quota work.
- The clinic console's older pages (Schedule, Patients) still read the seeded
  SQLite workspace. **Only Care Loop is the live loop.** Do not demo the two
  side by side and imply they are the same data.
