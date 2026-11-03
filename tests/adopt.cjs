// Enter a new room for acceptance tests that start after onboarding.
module.exports=async function adoptRoom(page,{profile=false}={}){
  await page.click('#adoptForm button[value=skip]');
  if(profile)await page.click('#openProfile');
};
