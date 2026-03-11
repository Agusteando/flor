export default defineEventHandler(async () => {
  const folderId = '1h3znz6TMa8hNskIyoBIzHFgYOS1X76bZ';
  try {
    // fetchFiles() is auto-imported from server/utils
    const files = await fetchFiles(folderId);
    return { files };
  } catch (error) {
    console.error('Error fetching files:', error);
    throw createError({ statusCode: 500, message: 'Internal Server Error' });
  }
});