# 🚀 HTTP Service - Beginner's Complete Guide

Welcome! This guide will teach you everything you need to know about using the HTTP Service in your Next.js application, from absolute basics to advanced patterns.

## 📚 Table of Contents

- [What is HTTP Service?](#what-is-http-service)
- [Your First API Call](#your-first-api-call)
- [Understanding the Basics](#understanding-the-basics)
- [Common Patterns](#common-patterns)
- [Error Handling Made Easy](#error-handling-made-easy)
- [Testing Your Code](#testing-your-code)
- [Real-World Examples](#real-world-examples)
- [Troubleshooting](#troubleshooting)

## 🤔 What is HTTP Service?

HTTP Service is a tool that helps your Next.js app talk to APIs (Application Programming Interfaces). Think of it as a smart messenger that:

- 📤 Sends requests to get or send data
- 📥 Receives responses with the data you need  
- 🔄 Automatically retries if something goes wrong
- 💾 Remembers responses to make your app faster
- 🔐 Handles authentication and security

### Why use HTTP Service instead of fetch()?

```typescript
// ❌ Raw fetch - lots of boilerplate code
const response = await fetch('https://api.example.com/users', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-token'
  },
  body: JSON.stringify({ name: 'John' })
});

if (!response.ok) {
  throw new Error('Request failed');
}

const data = await response.json();

// ✅ HTTP Service - clean and simple
const response = await httpService.post('/users', { name: 'John' });
// That's it! Error handling, headers, and JSON parsing are automatic
```

## 🎯 Your First API Call

Let's start with the simplest possible example:

```typescript
import { httpService } from '@repo/http-service';

// Get a list of users
async function getUsers() {
  const response = await httpService.get('/api/users');
  console.log(response.data); // Your user data is here!
}
```

That's it! You just made your first API call. Let's break down what happened:

1. **Import**: We brought in the HTTP service
2. **Request**: We asked for data from `/api/users`
3. **Response**: We got back data in `response.data`

## 📖 Understanding the Basics

### The Four Main HTTP Methods

Think of these as different ways to interact with data:

```typescript
// 📖 GET - Read data (like browsing a website)
const users = await httpService.get('/api/users');

// ✍️ POST - Create new data (like submitting a form)
const newUser = await httpService.post('/api/users', {
  name: 'Alice',
  email: 'alice@example.com'
});

// ✏️ PUT - Update existing data (like editing a profile)
const updatedUser = await httpService.put('/api/users/123', {
  name: 'Alice Smith',
  email: 'alice.smith@example.com'
});

// 🗑️ DELETE - Remove data (like deleting a post)
await httpService.delete('/api/users/123');
```

### Understanding Responses

Every API call returns a response object with useful information:

```typescript
const response = await httpService.get('/api/users');

console.log(response.data);        // The actual data you wanted
console.log(response.status);      // HTTP status code (200 = success)
console.log(response.statusText);  // Human-readable status ("OK")
console.log(response.headers);     // Additional info from the server
```

## 🔧 Common Patterns

### Setting Up Your API Client

Instead of using the default `httpService`, create your own configured client:

```typescript
import { HttpService } from '@repo/http-service';

// Create your customized API client
const apiClient = new HttpService({
  baseURL: 'https://api.yourapp.com',  // Your API's base URL
  timeout: 10000,                      // Wait 10 seconds max
  headers: {
    'Content-Type': 'application/json'
  }
});

// Now you can use shorter URLs
const users = await apiClient.get('/users'); // Goes to https://api.yourapp.com/users
```

### Adding Query Parameters

Query parameters are like filters for your data:

```typescript
// Get users with filters
const filteredUsers = await httpService.get('/api/users', {
  params: {
    page: 1,           // First page
    limit: 10,         // 10 users per page
    status: 'active',  // Only active users
    sort: 'name'       // Sort by name
  }
});
// This creates: /api/users?page=1&limit=10&status=active&sort=name
```

### Sending Data in Requests

```typescript
// Creating a new blog post
const newPost = await httpService.post('/api/posts', {
  title: 'My First Blog Post',
  content: 'This is the content of my post...',
  tags: ['javascript', 'beginners'],
  published: true
});

// Updating user preferences
const preferences = await httpService.put('/api/users/123/preferences', {
  theme: 'dark',
  notifications: true,
  language: 'en'
});
```

## 🚨 Error Handling Made Easy

Errors happen - here's how to handle them gracefully:

```typescript
async function fetchUserSafely(userId: string) {
  try {
    const response = await httpService.get(`/api/users/${userId}`);
    return response.data;
  } catch (error) {
    // Different types of errors
    if (error.status === 404) {
      console.log('User not found');
      return null;
    } else if (error.status === 500) {
      console.log('Server error - try again later');
      throw new Error('Server is having issues');
    } else if (error.isNetworkError) {
      console.log('Network problem - check your connection');
      throw new Error('Please check your internet connection');
    } else {
      console.log('Something unexpected happened:', error.message);
      throw error;
    }
  }
}
```

### Automatic Retries

HTTP Service automatically retries failed requests:

```typescript
const apiClient = new HttpService({
  retries: 3,        // Try 3 times if it fails
  retryDelay: 1000   // Wait 1 second between retries
});

// If this fails, it will automatically retry up to 3 times
const data = await apiClient.get('/api/unreliable-endpoint');
```

## 🧪 Testing Your Code

HTTP Service comes with testing utilities to make testing easy:

```typescript
import { createMockHttpService } from '@repo/http-service/testing';

// Create a mock service for testing
const mockService = createMockHttpService();

// Set up fake responses
mockService.mockGet('/api/users', {
  data: [
    { id: 1, name: 'John Doe' },
    { id: 2, name: 'Jane Smith' }
  ]
});

// Now test your function
async function testMyFunction() {
  const users = await mockService.get('/api/users');
  console.log(users.data); // Gets the fake data we set up
}
```

## 🌟 Real-World Examples

### Example 1: User Profile Page

```typescript
import { HttpService } from '@repo/http-service';

const api = new HttpService({
  baseURL: process.env.NEXT_PUBLIC_API_URL
});

export class UserService {
  // Get user profile
  static async getProfile(userId: string) {
    try {
      const response = await api.get(`/users/${userId}`);
      return response.data;
    } catch (error) {
      if (error.status === 404) {
        throw new Error('User not found');
      }
      throw new Error('Failed to load profile');
    }
  }

  // Update user profile
  static async updateProfile(userId: string, updates: any) {
    const response = await api.put(`/users/${userId}`, updates);
    return response.data;
  }

  // Upload profile picture
  static async uploadAvatar(userId: string, file: File) {
    const formData = new FormData();
    formData.append('avatar', file);

    const response = await api.post(`/users/${userId}/avatar`, formData);
    return response.data;
  }
}
```

### Example 2: Shopping Cart

```typescript
export class CartService {
  private static api = new HttpService({
    baseURL: '/api/cart'
  });

  // Get cart contents
  static async getCart() {
    const response = await this.api.get('/');
    return response.data;
  }

  // Add item to cart
  static async addItem(productId: string, quantity: number) {
    const response = await this.api.post('/items', {
      productId,
      quantity
    });
    return response.data;
  }

  // Update item quantity
  static async updateQuantity(itemId: string, quantity: number) {
    const response = await this.api.put(`/items/${itemId}`, {
      quantity
    });
    return response.data;
  }

  // Remove item from cart
  static async removeItem(itemId: string) {
    await this.api.delete(`/items/${itemId}`);
  }

  // Checkout
  static async checkout(paymentDetails: any) {
    const response = await this.api.post('/checkout', paymentDetails);
    return response.data;
  }
}
```

### Example 3: Next.js Page with Error Handling

```typescript
// pages/users/[id].tsx
import { GetServerSideProps } from 'next';
import { UserService } from '../../../services/UserService';

interface UserPageProps {
  user: any;
  error?: string;
}

export default function UserPage({ user, error }: UserPageProps) {
  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  try {
    const user = await UserService.getProfile(params?.id as string);
    return {
      props: { user }
    };
  } catch (error) {
    return {
      props: {
        error: error.message,
        user: null
      }
    };
  }
};
```

## 🚨 Troubleshooting

### Common Issues and Solutions

**Problem**: "TypeError: Cannot read property 'data' of undefined"

```typescript
// ❌ Wrong - not handling async properly
function getUsers() {
  const response = httpService.get('/api/users'); // Missing await!
  return response.data; // response is a Promise, not the actual response
}

// ✅ Correct
async function getUsers() {
  const response = await httpService.get('/api/users');
  return response.data;
}
```

**Problem**: "Request failed with status 404"

```typescript
// ❌ Wrong - not handling errors
const user = await httpService.get('/api/users/999'); // User doesn't exist

// ✅ Correct - handle the error
try {
  const user = await httpService.get('/api/users/999');
  return user.data;
} catch (error) {
  if (error.status === 404) {
    console.log('User not found');
    return null;
  }
  throw error;
}
```

**Problem**: "CORS error" or "Network error"

```typescript
// Make sure your API URL is correct
const api = new HttpService({
  // ❌ Wrong - mixing localhost and production
  baseURL: 'http://localhost:3000/api'

  // ✅ Correct - use environment variables
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api'
});
```

### Getting Help

1. **Check the console**: Look for error messages in your browser's developer tools
2. **Verify your API**: Test your API endpoints with tools like Postman
3. **Check the network tab**: See what requests are actually being sent
4. **Read the error message**: HTTP Service provides helpful error messages

## 🎉 You're Ready!

Congratulations! You now know how to:

- ✅ Make basic API calls with GET, POST, PUT, and DELETE
- ✅ Handle errors gracefully
- ✅ Set up your own API client
- ✅ Use query parameters and request data
- ✅ Test your code with mocks
- ✅ Build real-world applications

### Next Steps

1. **Practice**: Try building a simple todo app or user management system
2. **Explore**: Look at the advanced features like authentication and caching
3. **Read more**: Check out the [full API documentation](README.md) and [examples](EXAMPLES.md)

Happy coding! 🚀
