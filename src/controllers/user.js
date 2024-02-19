import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js"
import { User } from "../models/user.js"
import { ApiError } from "../utils/ApiError.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { 
    USER_NOT_FOUND,
    REFRESH_ACCESS_TOKEN_NOT_GENEARTED,
    USERNAME_OR_EMAIL_NOT_PROVIDED,
    INVALID_CREDENTIALS,
    SUCCESSFULL_LOGIN,
    SUCCESSFULL_LOGOUT,
    UNAUTHORIZED_REQUEST,
    INVALID_REFRESH_TOKEN,
    REFRESH_TOKEN_EXPIRED,
    ACCESS_TOKEN_REFRESHED
} from "../constants.js"
import  jwt from "jsonwebtoken";

const options = {
    httpOnly: true,
    secure: true
}

const generateAccessAndRefereshTokens = async (userId) => {
    try {
          const user = await User.findById(userId)
          const accessToken = user.generateAccessToken()
          const refreshToken = user.generateRefreshToken()

          user.refreshToken = refreshToken
          await user.save({ validateBeforeSave: false })

          return {accessToken, refreshToken}
    } catch (error) {
        throw new ApiError(500, REFRESH_ACCESS_TOKEN_NOT_GENEARTED)
    }
}

const registerUser = asyncHandler( async (req, res) => {
    const {fullName, email, username, password } = req.body
   
    if (
        [fullName, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
    }

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists")
    }
    //console.log(req.files);

    const avatarLocalPath = req.files?.avatar[0]?.path;
    //const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }
    

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) {
        throw new ApiError(400, "Avatar file is required")
    }
   

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email, 
        password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Successfully")
    )
})

const loginUser = asyncHandler( async(req, res) => {
    const {username, email, password} = req.body

    if (!(username || email)) {
        throw new ApiError(400, USERNAME_OR_EMAIL_NOT_PROVIDED)
    }

    const user = await User.findOne({
        $or: [{username}, {email}]
    })

    if (!user) {
        throw new ApiError(404, USER_NOT_FOUND)
    }

    const isValidPassword = await user.isPasswordCorrect(password)

    if (!isValidPassword) { 
        throw new ApiError(401, INVALID_CREDENTIALS)
    }

    const {accessToken, refreshToken} = await generateAccessAndRefereshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")   

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200, 
            {
                user: loggedInUser, accessToken, refreshToken
            },
            SUCCESSFULL_LOGIN
        )
    )
    
})

const logoutUser = asyncHandler( async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1 // this removes the field from document
            }
        },
        {
            new: true
        }
    )

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, SUCCESSFULL_LOGOUT))
})

const refreshAccessToken = asyncHandler( async(req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken) {
        throw new ApiError(401, UNAUTHORIZED_REQUEST)
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        const user = await User.findById(decodedToken?._id)
    
        if (!user) {
            throw new ApiError(401, INVALID_REFRESH_TOKEN)
        }
    
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, REFRESH_TOKEN_EXPIRED)     
        }

        const {accessToken, refreshToken: newRefreshToken} = await generateAccessAndRefereshTokens(user._id)
        
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200, 
                { accessToken, refreshToken: newRefreshToken},
                ACCESS_TOKEN_REFRESHED
            )
        )

    } catch (error) {
        throw new ApiError(401, error?.message || INVALID_REFRESH_TOKEN)
    }
})


export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken
}