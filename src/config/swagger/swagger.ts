import swaggerJSDoc from "swagger-jsdoc";

export const swaggerSpec = swaggerJSDoc({
    definition: {
        openapi: "3.0.0",
        info: {
            title: "HRMS API's",
            version: "1.0.0",
            description: "Comprehensive API documentation for the Human Resource Management System (HRMS) backend. This API enables secure management of users, organizations, departments, authentication, and meta data such as industries and locations. Designed for scalability and integration with modern HR workflows."
        }
    },
    apis: ["./src/modules/**/*.ts"], // Path to the API docs
});