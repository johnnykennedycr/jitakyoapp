// frontend/src/auth/userState.js

let currentUserProfile = null;

/**
 * Armazena o perfil do usuário logado.
 * @param {object} profile - O objeto de perfil do usuário.
 */
export const setUserProfile = (profile) => {
  currentUserProfile = profile;
};

/**
 * Retorna o perfil do usuário armazenado.
 * @returns {object|null}
 */
export const getUserProfile = () => {
  return currentUserProfile;
};