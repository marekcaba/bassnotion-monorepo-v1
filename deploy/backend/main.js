import { NestFactory } from "@nestjs/core";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import * as dotenv from "dotenv";
import { Get, Controller, Injectable, Logger, Module, UnauthorizedException, Post, HttpCode, HttpStatus, Body, UseGuards } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { createClient, AuthError } from "@supabase/supabase-js";
var __defProp$1 = Object.defineProperty;
var __getOwnPropDesc$8 = Object.getOwnPropertyDescriptor;
var __decorateClass$8 = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc$8(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp$1(target, key, result);
  return result;
};
let AppController = class {
  constructor(appService) {
    this.appService = appService;
  }
  getHello() {
    return this.appService.getHello();
  }
};
__decorateClass$8([
  Get()
], AppController.prototype, "getHello", 1);
AppController = __decorateClass$8([
  Controller()
], AppController);
var __getOwnPropDesc$7 = Object.getOwnPropertyDescriptor;
var __decorateClass$7 = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc$7(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = decorator(result) || result;
  return result;
};
let AppService = class {
  getHello() {
    return "Hello World!";
  }
};
AppService = __decorateClass$7([
  Injectable()
], AppService);
var __getOwnPropDesc$6 = Object.getOwnPropertyDescriptor;
var __decorateClass$6 = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc$6(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = decorator(result) || result;
  return result;
};
let DatabaseService = class {
  constructor(configService) {
    this.configService = configService;
    this.logger = new Logger(DatabaseService.name);
    if (!configService) {
      this.logger.error("ConfigService not injected properly");
      throw new Error("ConfigService not injected properly");
    }
    this.logger.debug("DatabaseService constructor called");
  }
  async onModuleInit() {
    try {
      this.logger.debug("Initializing Supabase client");
      if (!this.configService) {
        throw new Error("ConfigService is undefined in onModuleInit");
      }
      const supabaseUrl = this.configService.get("SUPABASE_URL");
      const supabaseKey = this.configService.get("SUPABASE_KEY");
      if (!supabaseUrl || !supabaseKey) {
        this.logger.error("Missing Supabase configuration", {
          hasUrl: !!supabaseUrl,
          hasKey: !!supabaseKey
        });
        throw new Error("Missing Supabase configuration. Please check your .env file");
      }
      this.supabase = createClient(supabaseUrl, supabaseKey);
      try {
        const { error } = await this.supabase.auth.getSession();
        if (error) {
          this.logger.error("Failed to initialize Supabase client:", error);
          throw error;
        }
        this.logger.debug("Supabase client initialized successfully");
      } catch (error) {
        this.logger.error("Error during Supabase client initialization:", error);
        throw error;
      }
    } catch (error) {
      this.logger.error("Fatal error in DatabaseService initialization:", error);
      throw error;
    }
  }
};
DatabaseService = __decorateClass$6([
  Injectable()
], DatabaseService);
var __getOwnPropDesc$5 = Object.getOwnPropertyDescriptor;
var __decorateClass$5 = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc$5(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = decorator(result) || result;
  return result;
};
let DatabaseModule = class {
};
DatabaseModule = __decorateClass$5([
  Module({
    providers: [DatabaseService],
    exports: [DatabaseService]
  })
], DatabaseModule);
var __getOwnPropDesc$4 = Object.getOwnPropertyDescriptor;
var __decorateClass$4 = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc$4(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = decorator(result) || result;
  return result;
};
let AuthGuard = class {
  constructor(authService) {
    this.authService = authService;
  }
  async canActivate(context) {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException("No token provided");
    }
    try {
      const user = await this.authService.validateToken(token);
      request.user = user;
      return true;
    } catch (error) {
      throw new UnauthorizedException("Invalid token");
    }
  }
  extractTokenFromHeader(request) {
    const [type, token] = request.headers.authorization?.split(" ") ?? [];
    return type === "Bearer" ? token : void 0;
  }
};
AuthGuard = __decorateClass$4([
  Injectable()
], AuthGuard);
var __defProp = Object.defineProperty;
var __getOwnPropDesc$3 = Object.getOwnPropertyDescriptor;
var __decorateClass$3 = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc$3(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
let AuthController = class {
  constructor(authService) {
    this.authService = authService;
    this.logger = new Logger(AuthController.name);
    this.logger.debug("AuthController constructor called");
  }
  async signup(signUpDto) {
    this.logger.debug(`Signup request received for email: ${signUpDto.email}`);
    return this.authService.registerUser(signUpDto);
  }
  async signin(signInDto) {
    this.logger.debug(`Signin request received for email: ${signInDto.email}`);
    return this.authService.authenticateUser(signInDto);
  }
  async getCurrentUser() {
    this.logger.debug("Get current user request received");
    return this.authService.getCurrentUser();
  }
};
__decorateClass$3([
  Post("signup"),
  HttpCode(HttpStatus.CREATED),
  __decorateParam(0, Body())
], AuthController.prototype, "signup", 1);
__decorateClass$3([
  Post("signin"),
  HttpCode(HttpStatus.OK),
  __decorateParam(0, Body())
], AuthController.prototype, "signin", 1);
__decorateClass$3([
  Get("me"),
  UseGuards(AuthGuard),
  HttpCode(HttpStatus.OK)
], AuthController.prototype, "getCurrentUser", 1);
AuthController = __decorateClass$3([
  Controller("auth")
], AuthController);
var __getOwnPropDesc$2 = Object.getOwnPropertyDescriptor;
var __decorateClass$2 = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc$2(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = decorator(result) || result;
  return result;
};
let AuthService = class {
  constructor(db) {
    this.db = db;
    this.logger = new Logger(AuthService.name);
    this.logger.debug("AuthService constructor called");
  }
  normalizeError(error) {
    if (error instanceof Error) {
      return {
        message: error.message,
        code: error instanceof AuthError ? String(error.status) : "UNKNOWN_ERROR"
      };
    }
    if (error && typeof error === "object" && "message" in error && "status" in error) {
      return {
        message: String(error.message),
        code: String(error.status)
      };
    }
    return {
      message: "An unknown error occurred",
      code: "UNKNOWN_ERROR"
    };
  }
  async registerUser(signUpDto) {
    this.logger.debug(`Registering user with email: ${signUpDto.email}`);
    try {
      const { data: auth, error } = await this.db.supabase.auth.signUp({
        email: signUpDto.email,
        password: signUpDto.password
      });
      if (error) {
        this.logger.error(`Error registering user: ${error.message}`);
        const errorResponse = {
          success: false,
          message: error.message,
          error: {
            code: String(error.status || "AUTH_ERROR"),
            details: error.message
          }
        };
        return errorResponse;
      }
      if (!auth.user) {
        const errorResponse = {
          success: false,
          message: "User registration failed",
          error: {
            code: "REGISTRATION_FAILED",
            details: "User registration failed"
          }
        };
        return errorResponse;
      }
      console.log("Before Supabase profile creation (registerUser):", {
        userId: auth.user.id,
        email: auth.user.email,
        displayName: signUpDto.displayName
      });
      const { data: profile, error: profileError } = await this.db.supabase.from("profiles").insert({
        id: auth.user.id,
        email: auth.user.email,
        display_name: signUpDto.displayName,
        bio: signUpDto.bio
      }).select().single();
      console.log("Result from Supabase single() call (registerUser):", {
        data: profile,
        error: profileError
      });
      if (profileError) {
        this.logger.error(
          `Error creating user profile: ${profileError.message}`,
          profileError.stack
        );
        const errorResponse = {
          success: false,
          message: profileError.message,
          error: {
            code: "PROFILE_CREATION_FAILED",
            details: "Failed to create user profile."
          }
        };
        return errorResponse;
      }
      if (!profile) {
        this.logger.error("User profile data is null after successful registration.");
        const errorResponse = {
          success: false,
          message: "User profile data missing",
          error: {
            code: "PROFILE_DATA_MISSING",
            details: "User profile data missing."
          }
        };
        return errorResponse;
      }
      const authData = {
        user: {
          id: profile.id,
          email: profile.email,
          displayName: profile.display_name,
          createdAt: profile.created_at,
          updatedAt: profile.updated_at
        },
        session: {
          accessToken: auth.session?.access_token || "",
          refreshToken: auth.session?.refresh_token || void 0,
          expiresIn: auth.session?.expires_in || 3600
        }
      };
      const successResponse = {
        success: true,
        message: "User registered successfully",
        data: authData
      };
      return successResponse;
    } catch (error) {
      const authError = this.normalizeError(error);
      this.logger.error(`Error in registerUser: ${authError.message}`);
      const errorResponse = {
        success: false,
        message: authError.message,
        error: {
          code: authError.code,
          details: authError.message
        }
      };
      return errorResponse;
    }
  }
  async authenticateUser(signInDto) {
    this.logger.debug(`Authenticating user with email: ${signInDto.email}`);
    try {
      const { data: auth, error } = await this.db.supabase.auth.signInWithPassword({
        email: signInDto.email,
        password: signInDto.password
      });
      if (error) {
        this.logger.error(`Error authenticating user: ${error.message}`);
        const errorResponse = {
          success: false,
          message: error.message,
          error: {
            code: String(error.status || "AUTH_ERROR"),
            details: error.message
          }
        };
        return errorResponse;
      }
      if (!auth.user) {
        const errorResponse = {
          success: false,
          message: "Authentication failed",
          error: {
            code: "AUTH_FAILED",
            details: "Authentication failed"
          }
        };
        return errorResponse;
      }
      console.log("Before Supabase profile fetch (authenticateUser):", {
        userId: auth.user.id,
        email: auth.user.email
      });
      const { data: profile, error: profileError } = await this.db.supabase.from("profiles").select().eq("id", auth.user.id).single();
      console.log("Result from Supabase single() call (authenticateUser):", {
        data: profile,
        error: profileError
      });
      if (profileError) {
        this.logger.error(
          `Error fetching user profile: ${profileError.message}`,
          profileError.stack
        );
        const errorResponse = {
          success: false,
          message: profileError.message,
          error: {
            code: "PROFILE_FETCH_FAILED",
            details: "Failed to fetch user profile."
          }
        };
        return errorResponse;
      }
      if (!profile) {
        this.logger.error("User profile data is null after successful authentication.");
        const errorResponse = {
          success: false,
          message: "User profile data missing",
          error: {
            code: "PROFILE_DATA_MISSING",
            details: "User profile data missing."
          }
        };
        return errorResponse;
      }
      const authData = {
        user: {
          id: profile.id,
          email: profile.email,
          displayName: profile.display_name,
          createdAt: profile.created_at,
          updatedAt: profile.updated_at
        },
        session: {
          accessToken: auth.session?.access_token || "",
          refreshToken: auth.session?.refresh_token || void 0,
          expiresIn: auth.session?.expires_in || 3600
        }
      };
      const successResponse = {
        success: true,
        message: "Successfully authenticated",
        data: authData
      };
      return successResponse;
    } catch (error) {
      const authError = this.normalizeError(error);
      this.logger.error(`Error in authenticateUser: ${authError.message}`);
      const errorResponse = {
        success: false,
        message: authError.message,
        error: {
          code: authError.code,
          details: authError.message
        }
      };
      return errorResponse;
    }
  }
  async validateToken(token) {
    try {
      const {
        data: { user },
        error
      } = await this.db.supabase.auth.getUser(token);
      if (error || !user) {
        throw new UnauthorizedException("Invalid token");
      }
      const { data: profile, error: profileError } = await this.db.supabase.from("profiles").select().eq("id", user.id).single();
      if (profileError || !profile) {
        throw new UnauthorizedException("User profile not found");
      }
      return {
        id: profile.id,
        email: profile.email,
        displayName: profile.display_name,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at
      };
    } catch (error) {
      throw new UnauthorizedException("Invalid token");
    }
  }
  async getCurrentUser() {
    try {
      const {
        data: { session },
        error
      } = await this.db.supabase.auth.getSession();
      if (error || !session?.user) {
        throw new UnauthorizedException("No active session");
      }
      const { data: profile, error: profileError } = await this.db.supabase.from("profiles").select().eq("id", session.user.id).single();
      if (profileError || !profile) {
        throw new UnauthorizedException("User profile not found");
      }
      return {
        id: profile.id,
        email: profile.email,
        displayName: profile.display_name,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at
      };
    } catch (error) {
      throw new UnauthorizedException("No active session");
    }
  }
};
AuthService = __decorateClass$2([
  Injectable()
], AuthService);
var __getOwnPropDesc$1 = Object.getOwnPropertyDescriptor;
var __decorateClass$1 = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc$1(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = decorator(result) || result;
  return result;
};
let AuthModule = class {
};
AuthModule = __decorateClass$1([
  Module({
    imports: [DatabaseModule],
    controllers: [AuthController],
    providers: [AuthService, AuthGuard],
    exports: [AuthService, AuthGuard]
  })
], AuthModule);
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = decorator(result) || result;
  return result;
};
let AppModule = class {
};
AppModule = __decorateClass([
  Module({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true
      }),
      AuthModule
    ],
    controllers: [AppController],
    providers: [AppService]
  })
], AppModule);
dotenv.config({ path: "../../.env" });
console.warn("DEBUG: Process CWD:", process.cwd());
console.warn("DEBUG: Loaded SUPABASE_URL:", process.env["SUPABASE_URL"]);
console.warn("DEBUG: Loaded SUPABASE_KEY:", process.env["SUPABASE_KEY"]);
async function bootstrap() {
  const app = await NestFactory.create(
    AppModule,
    new FastifyAdapter()
  );
  await app.enableCors({
    origin: process.env["FRONTEND_URL"] || "*",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    credentials: true
  });
  const port = process.env["PORT"] || 3e3;
  const host = "0.0.0.0";
  await app.listen(port, host);
  console.warn(`Application is running on: http://localhost:${port}`);
}
bootstrap().catch((error) => {
  console.error("Failed to start application:", error);
  process.exit(1);
});
