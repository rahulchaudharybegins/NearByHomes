
import "dotenv/config";
import express from "express";
import cors from "cors";
import { requireAuth, type AuthenticatedRequest } from "./middleware/requireAuth.js";

const app = express();
const PORT = 3000;

app.use(
  cors({
    origin: "http://localhost:5173",
  })
);

app.use(express.json());

const entryOptions = [
  {
    id: "owner",
    title: "I'm an Owner",
    description: "List your property for rent or sale.",
    icon: "key",
    action: "owner",
  },
  {
    id: "seeker",
    title: "Find a Home",
    description: "Discover nearby flats, BHK homes and PGs.",
    icon: "search",
    action: "seeker",
  },
  {
    id: "guest",
    title: "Continue as Guest",
    description: "Explore properties without creating an account.",
    icon: "user",
    action: "guest",
  },
];

app.get("/", (_req, res) => {
  res.send("Nearby Homes backend is running!");
});

app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    message: "Nearby Homes backend is running!",
  });
});

app.get("/api/entry-options", (_req, res) => {
  res.json({
    success: true,
    options: entryOptions,
  });
});

app.get("/api/me", requireAuth, (req, res) => {
  const authReq = req as AuthenticatedRequest;

  res.json({
    success: true,
    user: {
      id: authReq.authUser.id,
      email: authReq.authUser.email ?? null,
    },
  });
});

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
