import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import { ApiError } from "./utils/ApiError.js"
import { INTERNAL_SERVER_ERROR } from "./constants.js"

const app = express()

app.use(cors({
     origin: process.env.CROSS_ORIGIN,
     credentials: true
}))

app.use(express.json({ limit: "16kb"}))
app.use(express.urlencoded({extended: true, limit: "16kb"}))
app.use(express.static("public"))
app.use(cookieParser())

// routes import
import userRouter from "./routes/user.js"
import healthCheckRouter from "./routes/healthCheck.js"

app.use("/api/v1/users", userRouter);
app.use("/api/v1/healthCheck", healthCheckRouter)



// middlerware to convert the ApiError into json

app.use((err, _, res, _next) => {
     // Check if the error is an instance of ApiError
     if (err instanceof ApiError) {
         // Set the status code and send JSON response
        res.status(err.statusCode).json(err);
     } else {
         // For other errors, send a generic error response
         res.status(500).json({
             message: INTERNAL_SERVER_ERROR,
             success: false
         });
     }
 });
export { app }
