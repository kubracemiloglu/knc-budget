# KNC Budget

KNC Budget is a responsive budget and savings goal tracking application. It helps users track their income, expenses, spending limits, scheduled income and progress toward a financial goal.

All data is stored locally in the user’s browser. The application does not require an account or a backend service.



## Features

* Starting balance and current balance calculation
* Income and expense tracking
* Custom transaction categories and notes
* Quick transaction entry
* Savings goal creation and contribution tracking
* Goal progress percentage and remaining amount calculation
* Estimated completion time based on recent contributions
* Daily and weekly spending limits
* Visual warnings when spending limits are exceeded
* Scheduled income tracking
* Automatic transaction creation when scheduled income is received
* Monthly income and expense summaries
* Seven-day expense visualization
* Monthly category-based expense overview
* Filtering by transaction type, category and date
* Search by category or transaction note
* Responsive mobile and desktop interface
* Installable web application experience through a web app manifest
* Browser-based data persistence with localStorage

## Technology Stack

| Area         | Technologies         |
| ------------ | -------------------- |
| Framework    | Next.js 16           |
| Language     | TypeScript           |
| Interface    | React 19             |
| Styling      | Tailwind CSS 4       |
| Data Storage | Browser localStorage |
| Deployment   | Vercel-compatible    |

## Data and Privacy

KNC Budget does not use an external database, user account or authentication system. Financial records remain in the browser in which they were entered.

Because the data is stored locally:

* Data is not synchronized between devices.
* Clearing browser data may remove saved records.
* The application should not be treated as a replacement for professional financial software.

## Getting Started

Clone the repository:

```bash
git clone https://github.com/kubracemiloglu/knc-budget.git
cd knc-budget
```

Install the dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

## Production Build

```bash
npm run build
npm start
```

## Developer

**Kübra Nur Cemiloğlu**

Ege University — Computer Programming Graduate
Junior .NET Developer

* [GitHub](https://github.com/kubracemiloglu)
* [LinkedIn](https://www.linkedin.com/in/kubranurcemiloglu)
