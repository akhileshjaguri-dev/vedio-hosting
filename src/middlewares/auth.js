import { asyncHandler } from "../utils/asyncHandler.js";
import { 
    UNAUTHORIZED_REQUEST, 
    INVALID_ACCESS_TOKEN } from "../constants.js";
import { User } from "../models/user.js";
import { ApiError } from "../utils/ApiError.js";
import jwt from "jsonwebtoken"

export const verifyJWT = asyncHandler( async(req, _, next) => {

   try {
    const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ","")
 
    if (!token) {
     throw new ApiError(401, UNAUTHORIZED_REQUEST)
    }
 
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
 
    const user = await User.findById(decodedToken?._id).select("-password -refreshToken")
 
    if (!user) {
     throw new ApiError(401, INVALID_ACCESS_TOKEN)
    }
 
    req.user = user
    next()
   } catch (error) {
    throw new ApiError(401, error?.message || INVALID_ACCESS_TOKEN)
   }

})