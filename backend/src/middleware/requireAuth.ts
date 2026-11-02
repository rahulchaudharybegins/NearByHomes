
import type { Request, Response, NextFunction } from "express";
import { supabase } from "../supabase.js";

export type AuthenticatedRequest = Request & {
  authUser: {
    id: string;
    email?: string;
  };
};

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      error: "Authentication required.",
    });
    return;
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!token) {
    res.status(401).json({
      success: false,
      error: "Missing access token.",
    });
    return;
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      res.status(401).json({
        success: false,
        error: "Invalid or expired access token.",
      });
      return;
    }

    (req as AuthenticatedRequest).authUser = {
      id: data.user.id,
      ...(data.user.email ? { email: data.user.email } : {}),
    };

    next();
  } catch {
    res.status(503).json({
      success: false,
      error: "Unable to verify authentication right now.",
    });
  }
}
