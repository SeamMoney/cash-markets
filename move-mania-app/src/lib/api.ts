import { createAptosKeyPair } from "./aptos";
import { User } from "./schema"

const API_URL = process.env.API_URL || 'http://localhost:3008'

export async function doesUserExist(username: string) { 

  console.log(`${API_URL}/users/${username}`)

  try {
    const response = await fetch(
      `${API_URL}/users/${username}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
    return response.ok
  } catch (e) {
    return false
  }
}

export async function setUpUser(userToSetup: Omit<User, "public_address" | "private_key">) {
  
  const keyPair = await createAptosKeyPair();
  console.log(keyPair)

  console.log(userToSetup)

  console.log(`${API_URL}/users`)

  try {
    const response = await fetch(
      `${API_URL}/users`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...userToSetup,
          ...keyPair
        })
      }
    )
    return response.ok
  } catch (e) {
    return false
  }
}

export async function getUser(email: string): Promise<User | null> {

  console.log(`${API_URL}/users/${email}`)

  try {
    const response = await fetch(
      `${API_URL}/users/${email}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
    return response.json()
  } catch (e) {
    return null
  }
}

export async function setUpAndGetUser(userToSetup: Omit<User, "public_address" | "private_key">): Promise<User | null> {
  const userExists = await doesUserExist(userToSetup.email)
  if (!userExists) {
    const res = await setUpUser(userToSetup)
    if (res) {
      return getUser(userToSetup.email)
    } else {
      return null
    }
  } else {
    return getUser(userToSetup.email)
  }
}

export async function updateUser(email: string, user: User): Promise<boolean> {
  try {
    const response = await fetch(
      `${API_URL}/users/${email}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(user)
      }
    )
    return response.ok
  } catch (e) {
    return false
  }
}