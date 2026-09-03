# AI Prompts

The prompts actually used during development, in the order they were executed, grouped by objective. For each significant prompt, this document details what was asked, what was generated, and what had to be corrected.

---
<!-- 
## 2. Dashboard Refinement & Terminology Cleanup

### Prompt
> *"Dont keep repetative info in the dashboard and instead of using 'stalled pipeline alerts' and the word 'pipeline' use other meaningful word."*

### What you got
- The AI renamed the header to `"REAL-TIME HIRING METRICS & WORKFLOW OVERVIEW"`, replaced `"Candidate Pipeline by Stage"` with `"Candidates by Recruitment Stage"`, and replaced `"Stalled Pipeline Health"` with an updated alert container.

### What you corrected (Prompt that produced something suboptimal)
- **What went wrong initially:** The first version of the alert card still displayed redundant aggregate count boxes (`UN-DISMISSED STALLED: 2` and directly underneath repeated `INTERVIEW: 1, OFFER: 1`). It changed the title to `"Candidates Requiring Attention"`, but still repeated the same aggregate numbers twice and failed to display the actual candidates needing review.
- **What was corrected:** We modified the component to fetch the live `/api/alerts/stalled` endpoint directly and render the **actual candidate cards** (displaying candidate initials, candidate name, position, stage badge, and days inactive) with direct review links. This eliminated the redundant counters completely and replaced them with actionable recruiting intelligence.

--- -->

<!-- ## 1. Self-Service Registration & Role-Based Data Preservation

### Prompt
> *"I want a login/sign up registration form at the starting so that i can take users from input and they can choose their role themselves and preserve the dummy data for the respective roles so that when i signup/login i dont get empty page."*

### What you got
- The AI created a modern dual-tab `AuthPage` supporting Sign In, 1-Click Demo Logins, and Create Account with interactive role selection cards (**Recruiter** vs **Interviewer**).
- Added a `POST /api/auth/register` endpoint on the backend.

### What you corrected
- **What went wrong initially:** When testing newly created Interviewer accounts, the server registered the user correctly, but because interviewers can only see candidates they are assigned to, the new interviewer landed on a completely empty `"My Applications"` page with zero candidates.
- **What was corrected:** In `AuthService.register`, we implemented an automated assignment hook: whenever a user registers with the `INTERVIEWER` role, the server automatically queries active candidate applications across open positions and inserts assignments into `application_interviewers` with corresponding timeline audit events. This ensured new interviewers immediately have a populated queue of candidates to evaluate and review.
- Additionally, when testing in the browser, the registration request initially returned `404 Not Found` because the running backend server process had not reloaded the new route. We killed the background task and restarted it using `tsx watch` to ensure dynamic code hot-reloading. -->



