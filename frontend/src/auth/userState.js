let currentUserProfile = null;

export const setUserProfile = (profile) => {
  currentUserProfile = profile;
};

export const getUserProfile = () => {
  return currentUserProfile;
};