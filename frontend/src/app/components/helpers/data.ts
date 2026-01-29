
export const mapExistingDataToState = (existingData: any) => {
  const updatedFormData: { [key: string]: string } = {};
  const updatedBuildingData: { [key: string]: any } = {};

  if (existingData.Street) updatedFormData.street = existingData.Street;
  if (existingData.House_number) updatedFormData.number = existingData.House_number;
  if (existingData.City) updatedFormData.city = existingData.City;
  if (existingData.State) updatedFormData.state = existingData.State;
  if (existingData.Country) updatedFormData.country = existingData.Country;

  return { updatedFormData, updatedBuildingData };
};
