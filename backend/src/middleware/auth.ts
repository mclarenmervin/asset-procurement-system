import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
export type AuthRequest = Request & { user?: { id:string; role:string; organizationId:string } };
export function auth(req:AuthRequest,res:Response,next:NextFunction){
  const header=req.headers.authorization;
  const token=header?.startsWith('Bearer ')?header.slice(7):undefined;
  if(!token) return res.status(401).json({message:'Unauthorized'});
  try{ const payload=jwt.verify(token,process.env.JWT_SECRET!) as any;if(!payload.id||!payload.role||!payload.organizationId)throw new Error('Invalid claims');req.user=payload; next(); }
  catch{ return res.status(401).json({message:'Invalid token'}); }
}
export function authorize(...roles:string[]){return (req:AuthRequest,res:Response,next:NextFunction)=>roles.includes(req.user!.role)?next():res.status(403).json({message:'You do not have permission to perform this action'});}
