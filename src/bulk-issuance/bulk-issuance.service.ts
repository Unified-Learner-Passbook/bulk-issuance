import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { AxiosRequestConfig } from 'axios';
import { Response } from 'express';
import { CredentialsService } from 'src/services/credentials/credentials.service';
import { SbrcService } from 'src/services/sbrc/sbrc.service';
import { TelemetryService } from 'src/services/telemetry/telemetry.service';
import { AadharService } from 'src/services/aadhar/aadhar.service';
import { KeycloakService } from 'src/services/keycloak/keycloak.service';
import jwt_decode from 'jwt-decode';
import { UsersService } from 'src/services/users/users.service';
const { Readable } = require('stream');

@Injectable()
export class BulkIssuanceService {
  constructor(
    private credService: CredentialsService,
    private sbrcService: SbrcService,
    private telemetryService: TelemetryService,
    private aadharService: AadharService,
    private keycloakService: KeycloakService,
    private readonly httpService: HttpService,
    private usersService: UsersService,
  ) {}

  fs = require('fs');
  parse = require('csv-parse');
  async = require('async');
  papa = require('papaparse');

  //getClientToken
  async getClientToken(password: string, response: Response) {
    if (password === 'test@4321') {
      const clientToken = await this.keycloakService.getClientToken();
      return response.status(200).send({
        success: true,
        token: clientToken?.access_token ? clientToken.access_token : null,
      });
    } else {
      response.status(200).send({ success: false, status: 'wrong_password' });
    }
  }

  //getDID
  async getDID(uniquetext: string, response: Response) {
    if (uniquetext) {
      const generateddid = await this.credService.generateDid(uniquetext);
      if (generateddid?.error) {
        return response.status(400).send({
          success: false,
          status: 'did_generate_error',
          message: 'Identity Generation Failed ! Please Try Again.',
          result: generateddid?.error,
        });
      } else {
        var did = generateddid[0].verificationMethod[0].controller;
        return response.status(200).send({
          success: true,
          status: 'did_success',
          message: 'DID Success',
          result: did,
        });
      }
    } else {
      return response.status(400).send({
        success: false,
        status: 'invalid_request',
        message: 'Invalid Request. Not received All Parameters.',
        result: null,
      });
    }
  }

  //getIssuerRegister
  async getIssuerRegister(
    token: string,
    name: string,
    did: string,
    username: string,
    password: string,
    response: Response,
  ) {
    if (token && name && did && username && password) {
      let jwt_decode = await this.parseJwt(token);
      let clientId = jwt_decode?.clientId ? jwt_decode.clientId : [];
      //check admin roles in jwt
      if (clientId === process.env.KEYCLOAK_CLIENT_ID) {
        // find student
        let searchSchema = {
          filters: {
            did: {
              eq: did,
            },
          },
        };
        const issuerDetails = await this.sbrcService.sbrcSearch(
          searchSchema,
          'Issuer',
        );
        console.log('Issuer Details', issuerDetails);
        if (issuerDetails.length == 0) {
          //register in keycloak and then in sunbird rc
          //create keycloak and then login
          const clientToken = await this.keycloakService.getClientToken();
          console.log('clientToken', clientToken);
          if (clientToken?.error) {
            return response.status(401).send({
              success: false,
              status: 'keycloak_client_token_error',
              message: 'System Authentication Failed ! Please Try Again.',
              result: null,
            });
          } else {
            ///register in keycloak
            let response_text = await this.keycloakService.registerUserKeycloak(
              username,
              password,
              clientToken,
            );
            console.log('registerUserKeycloak', response_text);
            if (response_text?.error) {
              return response.status(400).send({
                success: false,
                status: 'keycloak_register_duplicate',
                message:
                  'You entered username Account Already Present in Keycloak.',
                result: null,
              });
            } else {
              //register and create account in sunbird rc
              let inviteSchema = {
                name: name,
                did: did,
                username: username,
              };
              console.log('inviteSchema', inviteSchema);
              let createIssuer = await this.sbrcService.sbrcInvite(
                inviteSchema,
                'Issuer',
              );
              console.log('createIssuer', createIssuer);
              if (createIssuer) {
                return response.status(200).send({
                  success: true,
                  status: 'sbrc_register_success',
                  message: 'Issuer Account Registered. Complete Aadhar KYC.',
                  result: null,
                });
              } else {
                //need to add rollback function for keycloak user delete
                let response_text_keycloak =
                  await this.keycloakService.deleteUserKeycloak(
                    username,
                    clientToken,
                  );
                if (response_text_keycloak?.error) {
                  return response.status(400).send({
                    success: false,
                    status: 'sbrc_invite_error_delete_keycloak',
                    message: 'Unable to Register Issuer. Try Again.',
                    result: null,
                  });
                } else {
                  return response.status(400).send({
                    success: false,
                    status: 'sbrc_invite_error',
                    message: 'Unable to Register Issuer. Try Again.',
                    result: null,
                  });
                }
              }
            }
          }
        } else if (issuerDetails.length > 0) {
          if (issuerDetails[0].username != '') {
            return response.status(400).send({
              success: false,
              status: 'sbrc_register_duplicate',
              message: `You entered DID account details already linked to an existing Keycloak account, which has a username ${issuerDetails[0].username}. You cannot set a new username for this account detail. Login using the linked username and password.`,
              result: null,
            });
          } else {
            //register in keycloak and then update username
            //register in keycloak
            //create keycloak and then login
            const clientToken = await this.keycloakService.getClientToken();
            if (clientToken?.error) {
              return response.status(401).send({
                success: false,
                status: 'keycloak_client_token_error',
                message: 'System Authentication Failed ! Please Try Again.',
                result: null,
              });
            } else {
              ///register in keycloak
              let response_text =
                await this.keycloakService.registerUserKeycloak(
                  username,
                  password,
                  clientToken,
                );
              if (response_text?.error) {
                return response.status(400).send({
                  success: false,
                  status: 'keycloak_register_duplicate',
                  message:
                    'You entered username Account Already Present in Keycloak.',
                  result: null,
                });
              } else {
                //update username and register in keycloak
                //update username
                let updateRes = await this.sbrcService.sbrcUpdate(
                  { username: username },
                  'Issuer',
                  issuerDetails[0].osid,
                );
                if (updateRes) {
                  return response.status(200).send({
                    success: true,
                    status: 'sbrc_register_success',
                    message:
                      'Issuer Account Registered. Login using username and password.',
                    result: null,
                  });
                } else {
                  //need to add rollback function for keycloak user delete
                  let response_text_keycloak =
                    await this.keycloakService.deleteUserKeycloak(
                      username,
                      clientToken,
                    );
                  if (response_text_keycloak?.error) {
                    return response.status(400).send({
                      success: false,
                      status: 'sbrc_invite_error_delete_keycloak',
                      message: 'Unable to Register Issuer. Try Again.',
                      result: null,
                    });
                  } else {
                    return response.status(200).send({
                      success: false,
                      status: 'sbrc_update_error',
                      message:
                        'Unable to Update Issuer Username ! Please Try Again.',
                      result: null,
                    });
                  }
                }
              }
            }
          }
        } else {
          return response.status(200).send({
            success: false,
            status: 'sbrc_search_error',
            message: 'Unable to search Issuer. Try Again.',
            result: null,
          });
        }
      } else {
        return response.status(400).send({
          success: false,
          status: 'invalid_request',
          message: 'Invalid Keycloak Token',
          result: null,
        });
      }
    } else {
      return response.status(400).send({
        success: false,
        status: 'invalid_request',
        message: 'Invalid Request. Not received All Parameters.',
        result: null,
      });
    }
  }

  //getDetailLearner
  async getDetailIssuer(token: string, response: Response) {
    if (token) {
      const studentUsername = await this.keycloakService.verifyUserToken(token);
      if (studentUsername?.error) {
        return response.status(401).send({
          success: false,
          status: 'keycloak_token_bad_request',
          message: 'You do not have access for this request.',
          result: null,
        });
      } else if (!studentUsername?.preferred_username) {
        return response.status(401).send({
          success: false,
          status: 'keycloak_token_error',
          message: 'Your Login Session Expired.',
          result: null,
        });
      } else {
        const sb_rc_search = await this.sbrcService.sbrcSearchEL('Issuer', {
          filters: {
            username: {
              eq: studentUsername?.preferred_username,
            },
          },
        });
        if (sb_rc_search?.error) {
          return response.status(501).send({
            success: false,
            status: 'sb_rc_search_error',
            message: 'System Search Error ! Please try again.',
            result: sb_rc_search?.error.message,
          });
        } else if (sb_rc_search.length === 0) {
          return response.status(404).send({
            success: false,
            status: 'sb_rc_search_no_found',
            message: 'Data Not Found in System.',
            result: null,
          });
        } else {
          return response.status(200).send({
            success: true,
            status: 'sb_rc_search_found',
            message: 'Data Found in System.',
            result: sb_rc_search[0],
          });
        }
      }
    } else {
      return response.status(400).send({
        success: false,
        status: 'invalid_request',
        message: 'Invalid Request. Not received token.',
        result: null,
      });
    }
  }

  //getListIssuer
  async getListIssuer(response: Response) {
    const sb_rc_search = await this.sbrcService.sbrcSearchEL('Issuer', {
      filters: {},
    });
    if (sb_rc_search?.error) {
      return response.status(501).send({
        success: false,
        status: 'sb_rc_search_error',
        message: 'System Search Error ! Please try again.',
        result: sb_rc_search?.error.message,
      });
    } else if (sb_rc_search.length === 0) {
      return response.status(404).send({
        success: false,
        status: 'sb_rc_search_no_found',
        message: 'Data Not Found in System.',
        result: null,
      });
    } else {
      let issuer_detail = [];
      for (let i = 0; i < sb_rc_search.length; i++) {
        issuer_detail.push({
          name: sb_rc_search[i].name,
          did: sb_rc_search[i].did,
        });
      }
      return response.status(200).send({
        success: true,
        status: 'sb_rc_search_found',
        message: 'Data Found in System.',
        result: issuer_detail,
      });
    }
  }

  //instructor
  //registerInstructor
  async registerInstructor(
    name: string,
    dob: string,
    gender: string,
    recoveryphone: string,
    issuer_did: string,
    school_name: string,
    school_id: string,
    username: string,
    password: string,
    response: Response,
  ) {
    if (
      name &&
      dob &&
      gender &&
      recoveryphone &&
      issuer_did &&
      school_name &&
      school_id &&
      username &&
      password
    ) {
      // find student
      let searchSchema = {
        filters: {
          name: {
            eq: name,
          },
          dob: {
            eq: dob,
          },
          gender: {
            eq: gender,
          },
        },
      };
      const instructorDetails = await this.sbrcService.sbrcSearch(
        searchSchema,
        'Instructor',
      );
      console.log('Instructor Details', instructorDetails);
      if (instructorDetails.length == 0) {
        //register in keycloak and then in sunbird rc
        //create keycloak and then login
        const clientToken = await this.keycloakService.getClientToken();
        console.log('clientToken', clientToken);
        if (clientToken?.error) {
          return response.status(401).send({
            success: false,
            status: 'keycloak_client_token_error',
            message: 'System Authentication Failed ! Please Try Again.',
            result: null,
          });
        } else {
          ///register in keycloak
          let response_text = await this.keycloakService.registerUserKeycloak(
            username,
            password,
            clientToken,
          );
          console.log('registerUserKeycloak', response_text);
          if (response_text?.error) {
            return response.status(400).send({
              success: false,
              status: 'keycloak_register_duplicate',
              message:
                'You entered username Account Already Present in Keycloak.',
              result: null,
            });
          } else {
            //generate did
            let instructor_did = '';
            let didRes = await this.credService.generateDid(username + name);
            if (didRes) {
              instructor_did = didRes[0].verificationMethod[0].controller;
              //register and create account in sunbird rc
              let inviteSchema = {
                name: name,
                dob: dob,
                gender: gender,
                did: instructor_did,
                username: username,
                aadhaar_token: '',
                kyc_aadhaar_token: '',
                recoveryphone: recoveryphone,
                issuer_did: issuer_did,
                school_name: school_name,
                school_id: school_id,
              };
              console.log('inviteSchema', inviteSchema);
              let createInstructor = await this.sbrcService.sbrcInvite(
                inviteSchema,
                'Instructor',
              );
              console.log('createInstructor', createInstructor);
              if (createInstructor) {
                return response.status(200).send({
                  success: true,
                  status: 'sbrc_register_success',
                  message: 'User Account Registered. Complete Aadhar KYC.',
                  needkyc: true,
                  result: null,
                });
              } else {
                //need to add rollback function for keycloak user delete
                let response_text_keycloak =
                  await this.keycloakService.deleteUserKeycloak(
                    username,
                    clientToken,
                  );
                if (response_text_keycloak?.error) {
                  return response.status(400).send({
                    success: false,
                    status: 'sbrc_invite_error_delete_keycloak',
                    message: 'Unable to Register Instructor. Try Again.',
                    result: null,
                  });
                } else {
                  return response.status(400).send({
                    success: false,
                    status: 'sbrc_invite_error',
                    message: 'Unable to Register Instructor. Try Again.',
                    result: null,
                  });
                }
              }
            } else {
              //need to add rollback function for keycloak user delete
              let response_text_keycloak =
                await this.keycloakService.deleteUserKeycloak(
                  username,
                  clientToken,
                );
              if (response_text_keycloak?.error) {
                return response.status(400).send({
                  success: false,
                  status: 'did_generate_error_delete_keycloak',
                  message:
                    'Unable to Generate Instructor DID ! Please Try Again.',
                  result: null,
                });
              } else {
                return response.status(400).send({
                  success: false,
                  status: 'did_generate_fail',
                  message:
                    'Unable to Generate Instructor DID ! Please Try Again.',
                  result: null,
                });
              }
            }
          }
        }
      } else if (instructorDetails.length > 0) {
        if (instructorDetails[0].username != '') {
          return response.status(400).send({
            success: false,
            status: 'sbrc_register_duplicate',
            message: `You entered account details already linked to an existing Keycloak account, which has a username ${instructorDetails[0].username}. You cannot set a new username for this account detail. Login using the linked username and password.`,
            result: null,
          });
        } else {
          //register in keycloak and then update username
          //register in keycloak
          //create keycloak and then login
          const clientToken = await this.keycloakService.getClientToken();
          if (clientToken?.error) {
            return response.status(401).send({
              success: false,
              status: 'keycloak_client_token_error',
              message: 'System Authentication Failed ! Please Try Again.',
              result: null,
            });
          } else {
            ///register in keycloak
            let response_text = await this.keycloakService.registerUserKeycloak(
              username,
              password,
              clientToken,
            );
            if (response_text?.error) {
              return response.status(400).send({
                success: false,
                status: 'keycloak_register_duplicate',
                message:
                  'You entered username Account Already Present in Keycloak.',
                result: null,
              });
            } else {
              //update username and register in keycloak
              //update username
              let updateRes = await this.sbrcService.sbrcUpdate(
                { username: username },
                'Instructor',
                instructorDetails[0].osid,
              );
              if (updateRes) {
                if (instructorDetails[0].kyc_aadhaar_token == '') {
                  return response.status(200).send({
                    success: true,
                    status: 'sbrc_register_success',
                    message: 'User Account Registered. Complete Aadhar KYC.',
                    needkyc: true,
                    result: null,
                  });
                } else {
                  return response.status(200).send({
                    success: true,
                    status: 'sbrc_register_success',
                    message:
                      'User Account Registered. Login using username and password.',
                    result: null,
                  });
                }
              } else {
                //need to add rollback function for keycloak user delete
                let response_text_keycloak =
                  await this.keycloakService.deleteUserKeycloak(
                    username,
                    clientToken,
                  );
                if (response_text_keycloak?.error) {
                  return response.status(400).send({
                    success: false,
                    status: 'sbrc_invite_error_delete_keycloak',
                    message: 'Unable to Register Instructor. Try Again.',
                    result: null,
                  });
                } else {
                  return response.status(200).send({
                    success: false,
                    status: 'sbrc_update_error',
                    message:
                      'Unable to Update Instructor Username ! Please Try Again.',
                    result: null,
                  });
                }
              }
            }
          }
        }
      } else {
        return response.status(200).send({
          success: false,
          status: 'sbrc_search_error',
          message: 'Unable to search Instructor. Try Again.',
          result: null,
        });
      }
    } else {
      return response.status(400).send({
        success: false,
        status: 'invalid_request',
        message: 'Invalid Request. Not received All Parameters.',
        result: null,
      });
    }
  }

  //getAadhaarTokenUpdate
  async getAadhaarTokenUpdate(
    response: Response,
    aadhaar_id: string,
    aadhaar_name: string,
    aadhaar_dob: string,
    aadhaar_gender: string,
  ) {
    if (aadhaar_id && aadhaar_name && aadhaar_dob && aadhaar_gender) {
      const aadhar_data = await this.aadharService.aadhaarDemographic(
        aadhaar_id,
        aadhaar_name,
        aadhaar_dob,
        aadhaar_gender,
      );
      //console.log(aadhar_data);
      if (!aadhar_data?.success === true) {
        return response.status(400).send({
          success: false,
          status: 'aadhaar_api_error',
          message: 'Aadhar API Not Working',
          result: aadhar_data?.result,
        });
      } else {
        if (aadhar_data?.result?.ret === 'y') {
          const decodedxml = aadhar_data?.decodedxml;
          const uuid = await this.aadharService.getUUID(decodedxml);
          if (uuid === null) {
            return response.status(400).send({
              success: false,
              status: 'aadhaar_api_uuid_error',
              message: 'Aadhar API UUID Not Found',
              result: uuid,
            });
          } else {
            //update uuid in user data
            // find student
            let searchSchema = {
              filters: {
                name: {
                  eq: aadhaar_name,
                },
                dob: {
                  eq: aadhaar_dob,
                },
                gender: {
                  eq: aadhaar_gender,
                },
              },
            };
            const instructorDetails = await this.sbrcService.sbrcSearch(
              searchSchema,
              'Instructor',
            );
            console.log('Instructor Details', instructorDetails);
            if (instructorDetails.length == 0) {
              //register in keycloak and then in sunbird rc
              return response.status(400).send({
                success: false,
                status: 'sbrc_instructor_no_found_error',
                message:
                  'Instructor Account Not Found. Register and Try Again.',
                result: null,
              });
            } else if (instructorDetails.length > 0) {
              //update kyc aadhar token
              //update username
              let updateRes = await this.sbrcService.sbrcUpdate(
                { kyc_aadhaar_token: uuid },
                'Instructor',
                instructorDetails[0].osid,
              );
              if (updateRes) {
                return response.status(200).send({
                  success: true,
                  status: 'aadhaar_api_success',
                  message: 'Aadhar API Working',
                  result: null,
                });
              } else {
                return response.status(200).send({
                  success: false,
                  status: 'sbrc_update_error',
                  message:
                    'Unable to Update Instructor Aadhaar KYC Token ! Please Try Again.',
                  result: null,
                });
              }
            } else {
              return response.status(200).send({
                success: false,
                status: 'sbrc_search_error',
                message: 'Unable to search Learner. Try Again.',
                result: null,
              });
            }
          }
        } else {
          return response.status(200).send({
            success: false,
            status: 'invalid_aadhaar',
            message: 'Invalid Aadhaar',
            result: null,
          });
        }
      }
    } else {
      return response.status(400).send({
        success: false,
        status: 'invalid_request',
        message: 'Invalid Request. Not received All Parameters.',
        result: null,
      });
    }
  }

  //get detail
  //getDetailInstructor
  async getDetailInstructor(token: string, response: Response) {
    if (token) {
      const instructorUsername = await this.keycloakService.verifyUserToken(token);
      if (instructorUsername?.error) {
        return response.status(401).send({
          success: false,
          status: 'keycloak_token_bad_request',
          message: 'You do not have access for this request.',
          result: null,
        });
      } else if (!instructorUsername?.preferred_username) {
        return response.status(401).send({
          success: false,
          status: 'keycloak_token_error',
          message: 'Your Login Session Expired.',
          result: null,
        });
      } else {
        const sb_rc_search = await this.sbrcService.sbrcSearchEL('Instructor', {
          filters: {
            username: {
              eq: instructorUsername?.preferred_username,
            },
          },
        });
        if (sb_rc_search?.error) {
          return response.status(501).send({
            success: false,
            status: 'sb_rc_search_error',
            message: 'System Search Error ! Please try again.',
            result: sb_rc_search?.error.message,
          });
        } else if (sb_rc_search.length === 0) {
          return response.status(404).send({
            success: false,
            status: 'sb_rc_search_no_found',
            message: 'Data Not Found in System.',
            result: null,
          });
        } else {
          return response.status(200).send({
            success: true,
            status: 'sb_rc_search_found',
            message: 'Data Found in System.',
            result: sb_rc_search[0],
          });
        }
      }
    } else {
      return response.status(400).send({
        success: false,
        status: 'invalid_request',
        message: 'Invalid Request. Not received token.',
        result: null,
      });
    }
  }

  //getDetailDigiInstructor
  async getDetailDigiInstructor(
    token: string,
    name: string,
    dob: string,
    gender: string,
    response: Response,
  ) {
    if (token && name && dob && gender) {
      const instructorUsername = await this.keycloakService.verifyUserToken(token);
      if (instructorUsername?.error) {
        return response.status(401).send({
          success: false,
          status: 'keycloak_token_bad_request',
          message: 'You do not have access for this request.',
          result: null,
        });
      } else if (!instructorUsername?.preferred_username) {
        return response.status(401).send({
          success: false,
          status: 'keycloak_token_error',
          message: 'Your Login Session Expired.',
          result: null,
        });
      } else {
        const sb_rc_search = await this.sbrcService.sbrcSearchEL('Instructor', {
          filters: {
            name: {
              eq: name,
            },
            dob: {
              eq: dob,
            },
            gender: {
              eq: gender,
            },
          },
        });
        if (sb_rc_search?.error) {
          return response.status(501).send({
            success: false,
            status: 'sb_rc_search_error',
            message: 'System Search Error ! Please try again.',
            result: sb_rc_search?.error.message,
          });
        } else if (sb_rc_search.length === 0) {
          return response.status(404).send({
            success: false,
            status: 'sb_rc_search_no_found',
            message: 'Data Not Found in System.',
            result: null,
          });
        } else {
          return response.status(200).send({
            success: true,
            status: 'sb_rc_search_found',
            message: 'Data Found in System.',
            result: sb_rc_search[0],
          });
        }
      }
    } else {
      return response.status(400).send({
        success: false,
        status: 'invalid_request',
        message: 'Invalid Request. Not received token.',
        result: null,
      });
    }
  }

  //getCredentialSchemaCreate
  async getCredentialSchemaCreate(postrequest: any, response: Response) {
    if (postrequest) {
      const getschemacreate = await this.credService.schemaCreate(postrequest);
      if (getschemacreate?.error) {
        return response.status(400).send({
          success: false,
          status: 'get_schema_error',
          message: 'Get Schema Create Failed ! Please Try Again.',
          result: getschemacreate,
        });
      } else {
        return response.status(200).send({
          success: true,
          status: 'schema_create_success',
          message: 'Schema Create Success',
          result: getschemacreate,
        });
      }
    } else {
      return response.status(400).send({
        success: false,
        status: 'invalid_request',
        message: 'Invalid Request. Not received All Parameters.',
        result: null,
      });
    }
  }
  //getCredentialSchemaList
  async getCredentialSchemaList(postrequest: any, response: Response) {
    if (postrequest?.taglist) {
      console.log(postrequest.taglist);
      const getschemalist = await this.credService.schemaList(
        '[' + postrequest?.taglist + ']',
      );
      if (getschemalist?.error) {
        return response.status(400).send({
          success: false,
          status: 'get_schema_error',
          message: 'Get Schema List Failed ! Please Try Again.',
          result: null,
        });
      } else {
        if (getschemalist.length > 0) {
          let schemalist = [];
          for (let i = 0; i < getschemalist.length; i++) {
            schemalist.push({
              schema_name: getschemalist[i]?.name,
              schema_id: getschemalist[i]?.id,
            });
          }
          return response.status(200).send({
            success: true,
            status: 'schema_list_success',
            message: 'Schema List Success',
            result: schemalist,
          });
        } else {
          return response.status(200).send({
            success: false,
            status: 'get_schema_list_no_found',
            message: 'Get Schema List Not Found ! Please Change Tags.',
            result: null,
          });
        }
      }
    } else {
      return response.status(400).send({
        success: false,
        status: 'invalid_request',
        message: 'Invalid Request. Not received All Parameters.',
        result: null,
      });
    }
  }

  //getSchemaFields
  async getSchemaFields(schema_id: string, response: Response) {
    if (schema_id) {
      const getschema = await this.credService.generateSchema(schema_id);
      if (!getschema) {
        return response.status(400).send({
          success: false,
          status: 'get_schema_error',
          message: 'Get Schema Failed or Schema Not Found ! Please Try Again.',
          result: null,
        });
      } else {
        if (getschema?.schema?.required) {
          let schema_fields = getschema?.schema?.properties;
          let required_fileds = getschema?.schema?.required;
          let learner_schema_field =
            process.env.LEARNER_SCHEMA_FIELD.split(' ');
          for (let i = 0; i < learner_schema_field.length; i++) {
            if (!required_fileds.includes(learner_schema_field[i])) {
              required_fileds.push(learner_schema_field[i]);
            }
          }
          let allfields = Object.keys(schema_fields);
          let optional_fileds = [];
          for (let i = 0; i < allfields.length; i++) {
            let found = false;
            for (let j = 0; j < required_fileds.length; j++) {
              if (allfields[i] === required_fileds[j]) {
                found = true;
                break;
              }
            }
            if (!found) {
              optional_fileds.push(allfields[i]);
            }
          }

          let schema_result = {
            id: getschema?.id,
            name: getschema?.name,
            version: getschema?.version,
            author: getschema?.author,
            schemaid: getschema?.schema?.$id,
            required: required_fileds,
            optional: optional_fileds,
          };

          return response.status(200).send({
            success: true,
            status: 'schema_success',
            message: 'Schema Success',
            result: schema_result,
          });
        } else {
          return response.status(400).send({
            success: false,
            status: 'get_schema_error',
            message: 'Get Schema Required Failed ! Please Try Again.',
            result: null,
          });
        }
      }
    } else {
      return response.status(400).send({
        success: false,
        status: 'invalid_request',
        message: 'Invalid Request. Not received All Parameters.',
        result: null,
      });
    }
  }

  //getCredentialIssue
  async getCredentialIssue(postrequest: any, response: Response) {
    if (
      postrequest?.schema_id &&
      postrequest?.issuerDetail?.did &&
      postrequest?.vcData &&
      postrequest?.credentialSubject
    ) {
      const getschema = await this.credService.generateSchema(
        postrequest?.schema_id,
      );
      if (!getschema) {
        return response.status(400).send({
          success: false,
          status: 'get_schema_error',
          message: 'Get Schema Failed or Schema Not Found ! Please Try Again.',
          result: null,
        });
      } else {
        if (getschema?.schema?.required) {
          //all fields
          let schema_fields = getschema?.schema?.properties;
          let all_schema_properties_fields = Object.keys(schema_fields);
          //required_fileds
          let required_fileds = getschema?.schema?.required;
          let invite_fileds = [];
          let learner_schema_field =
            process.env.LEARNER_SCHEMA_FIELD.split(' ');
          for (let i = 0; i < learner_schema_field.length; i++) {
            invite_fileds.push(learner_schema_field[i]);
          }
          let all_imp_fields = required_fileds;
          for (let i = 0; i < learner_schema_field.length; i++) {
            if (!all_imp_fields.includes(learner_schema_field[i])) {
              all_imp_fields.push(learner_schema_field[i]);
            }
          }
          //register bulk student
          let credentialPlayload = postrequest;
          let schemaId = postrequest?.schema_id;
          console.log('credentialPlayload: ', credentialPlayload);
          console.log('schemaId: ', schemaId);

          var issuerId = credentialPlayload.issuerDetail.did;

          //generate schema
          var schemaRes = getschema;
          console.log('schemaRes', schemaRes);

          if (schemaRes) {
            //error log report
            let iserror = false;
            let loglist = [];
            let error_count = 0;
            let success_count = 0;
            let i_count = 0;

            var responseArray = [];

            // bulk import
            for (const iterator of credentialPlayload.credentialSubject) {
              loglist[i_count] = {};
              loglist[i_count].studentDetails = iterator;

              try {
                //check iterator present all required field or not
                let valid_data = true;
                let not_found = '';
                //check validation
                let allfields = Object.keys(iterator);
                for (let i = 0; i < all_imp_fields.length; i++) {
                  let found = false;
                  for (let j = 0; j < allfields.length; j++) {
                    if (all_imp_fields[i] === allfields[j]) {
                      found = true;
                      break;
                    }
                  }
                  if (!found) {
                    not_found = all_imp_fields[i];
                    valid_data = false;
                  }
                }
                //check validation
                if (valid_data) {
                  console.log(
                    'all_schema_properties_fields',
                    all_schema_properties_fields,
                  );
                  console.log('iterator', iterator);
                  let new_iterator = {};
                  for (
                    let i = 0;
                    i < all_schema_properties_fields.length;
                    i++
                  ) {
                    if (iterator[all_schema_properties_fields[i]]) {
                      new_iterator[all_schema_properties_fields[i]] =
                        iterator[all_schema_properties_fields[i]];
                    }
                  }
                  console.log('new_iterator', new_iterator);
                  //generate did or find did
                  var name = iterator.student_name;
                  var dob = iterator.dob;
                  var gender = iterator.gender;
                  var aadhaar_token = iterator.aadhaar_token;

                  // find student
                  let searchSchema = {
                    filters: {
                      name: {
                        eq: name,
                      },
                      dob: {
                        eq: dob,
                      },
                      gender: {
                        eq: gender,
                      },
                    },
                  };
                  const studentDetails = await this.sbrcService.sbrcSearch(
                    searchSchema,
                    'Learner',
                  );
                  console.log('Learner Details', studentDetails);
                  if (
                    typeof studentDetails !== 'undefined' &&
                    studentDetails !== null
                  ) {
                    if (studentDetails.length > 0) {
                      if (studentDetails[0]?.did) {
                        new_iterator['id'] = studentDetails[0].did;
                        let obj = {
                          issuerId: issuerId,
                          credSchema: schemaRes,
                          credentialSubject: new_iterator,
                          issuanceDate: credentialPlayload.vcData.issuanceDate,
                          expirationDate:
                            credentialPlayload.vcData.expirationDate,
                        };
                        console.log('obj', obj);

                        const cred = await this.credService.issueCredentials(
                          obj,
                        );
                        //console.log("cred 34", cred)
                        if (cred) {
                          responseArray.push(cred);
                          loglist[i_count].status = true;
                          loglist[i_count].error = {};
                          success_count++;
                        } else {
                          responseArray.push({
                            error: 'unable to issue credentials!',
                          });
                          iserror = true;
                          loglist[i_count].status = false;
                          loglist[i_count].error =
                            'Unable to Issue Credentials ! Please Try Again.';
                          //loglist[i_count].errorlog = {};
                          error_count++;
                        }
                      } else {
                        let didRes = await this.credService.generateDid(
                          aadhaar_token,
                        );
                        console.log('did', didRes);
                        if (didRes) {
                          new_iterator['id'] =
                            didRes[0].verificationMethod[0].controller;
                          let updateRes = await this.sbrcService.sbrcUpdate(
                            {
                              did: new_iterator['id'],
                              aadhaar_token: aadhaar_token,
                            },
                            'Learner',
                            studentDetails[0].osid,
                          );
                          if (updateRes) {
                            let obj = {
                              issuerId: issuerId,
                              credSchema: schemaRes,
                              credentialSubject: new_iterator,
                              issuanceDate:
                                credentialPlayload.vcData.issuanceDate,
                              expirationDate:
                                credentialPlayload.vcData.expirationDate,
                            };
                            console.log('obj', obj);

                            if (new_iterator['id']) {
                              const cred =
                                await this.credService.issueCredentials(obj);
                              //console.log("cred 34", cred)
                              if (cred) {
                                responseArray.push(cred);
                                loglist[i_count].status = true;
                                loglist[i_count].error = {};
                                success_count++;
                              } else {
                                responseArray.push({
                                  error: 'unable to issue credentials!',
                                });
                                iserror = true;
                                loglist[i_count].status = false;
                                loglist[i_count].error =
                                  'Unable to Issue Credentials ! Please Try Again.';
                                //loglist[i_count].errorlog = {};
                                error_count++;
                              }
                            }
                          } else {
                            responseArray.push({
                              error: 'unable to update did inside RC!',
                            });
                            iserror = true;
                            loglist[i_count].status = false;
                            loglist[i_count].error =
                              'Unable to Update Student Identity ! Please Try Again.';
                            //loglist[i_count].errorlog = {};
                            error_count++;
                          }
                        } else {
                          responseArray.push({
                            error: 'unable to generate student did!',
                          });
                          iserror = true;
                          loglist[i_count].status = false;
                          loglist[i_count].error =
                            'Unable to Generate Student DID ! Please Try Again.';
                          //loglist[i_count].errorlog = {};
                          error_count++;
                        }
                      }
                    } else {
                      let didRes = await this.credService.generateDid(
                        aadhaar_token,
                      );

                      if (didRes) {
                        new_iterator['id'] =
                          didRes[0].verificationMethod[0].controller;
                        let inviteSchema = {
                          name: iterator['student_name'],
                          dob: iterator['dob'],
                          gender: iterator['gender'],
                          did: new_iterator['id'],
                          username: '',
                          aadhaar_token: iterator['aadhaar_token'],
                          kyc_aadhaar_token: '',
                          recoveryphone: '',
                        };
                        console.log('inviteSchema', inviteSchema);
                        let createStudent = await this.sbrcService.sbrcInvite(
                          inviteSchema,
                          'Learner',
                        );
                        console.log('createStudent', createStudent);

                        if (createStudent) {
                          let obj = {
                            issuerId: issuerId,
                            credSchema: schemaRes,
                            credentialSubject: new_iterator,
                            issuanceDate:
                              credentialPlayload.vcData.issuanceDate,
                            expirationDate:
                              credentialPlayload.vcData.expirationDate,
                          };
                          console.log('obj', obj);

                          const cred = await this.credService.issueCredentials(
                            obj,
                          );
                          //console.log("cred 34", cred)
                          if (cred) {
                            responseArray.push(cred);
                            loglist[i_count].status = true;
                            loglist[i_count].error = {};
                            success_count++;
                          } else {
                            responseArray.push({
                              error: 'unable to issue credentials!',
                            });
                            iserror = true;
                            loglist[i_count].status = false;
                            loglist[i_count].error =
                              'Unable to Issue Credentials ! Please Try Again.';
                            //loglist[i_count].errorlog = {};
                            error_count++;
                          }
                        } else {
                          responseArray.push({
                            error: 'unable to create student in RC!',
                          });
                          iserror = true;
                          loglist[i_count].status = false;
                          loglist[i_count].error =
                            'Unable to Create Student Account ! Please Try Again.';
                          //loglist[i_count].errorlog = {};
                          error_count++;
                        }
                      } else {
                        responseArray.push({
                          error: 'unable to generate student did!',
                        });
                        iserror = true;
                        loglist[i_count].status = false;
                        loglist[i_count].error =
                          'Unable to Generate Student DID ! Please Try Again.';
                        //loglist[i_count].errorlog = {};
                        error_count++;
                      }
                    }
                  } else {
                    responseArray.push({
                      error: 'unable to search student in RC!',
                    });
                    iserror = true;
                    loglist[i_count].status = false;
                    loglist[i_count].error =
                      'Unable to Search Student Account ! Please Try Again.';
                    //loglist[i_count].errorlog = {};
                    error_count++;
                  }
                } else {
                  responseArray.push({
                    error: 'not received schema required fields: ' + not_found,
                  });
                  iserror = true;
                  loglist[i_count].status = false;
                  loglist[i_count].error =
                    'not received schema required fields: ' + not_found;
                  //loglist[i_count].errorlog = {};
                  error_count++;
                }
              } catch (e) {
                console.log(e);
                iserror = true;
                loglist[i_count].status = false;
                loglist[i_count].error = 'System Exception ! Please Try Again.';
                loglist[i_count].errorlog = JSON.stringify(e);
                error_count++;
              }
              i_count++;
            }

            return response.status(200).send({
              success: true,
              status: 'student_bulk_upload_api_success',
              iserror: iserror,
              message: 'Student Bulk Upload API Success.',
              error_count: error_count,
              success_count: success_count,
              result: loglist,
            });
          } else {
            return response.status(200).send({
              success: false,
              status: 'did_cred_generate_error',
              message:
                'User Identity and Credentials Generation Failed. Schema Not Found. Try Again.',
              result: null,
            });
          }
        } else {
          return response.status(400).send({
            success: false,
            status: 'get_schema_error',
            message: 'Get Schema Required Failed ! Please Try Again.',
            result: null,
          });
        }
      }
    } else {
      return response.status(400).send({
        success: false,
        status: 'invalid_request',
        message: 'Invalid Request. Not received All Parameters.',
        result: null,
      });
    }
  }

  //getUserCreate
  async getUserCreate(postrequest: any, response: Response) {
    if (
      postrequest?.name &&
      postrequest?.dob &&
      postrequest?.gender &&
      postrequest?.recoveryphone &&
      postrequest?.username &&
      postrequest?.password &&
      postrequest?.aadhaar_token
    ) {
      let name = postrequest.name;
      let dob = postrequest.dob;
      let gender = postrequest.gender;
      let recoveryphone = postrequest.recoveryphone;
      let username = postrequest.username;
      let password = postrequest.password;
      let aadhaar_token = postrequest.aadhaar_token;
      // find student
      let searchSchema = {
        filters: {
          name: {
            eq: name,
          },
          dob: {
            eq: dob,
          },
          gender: {
            eq: gender,
          },
        },
      };
      const studentDetails = await this.sbrcService.sbrcSearch(
        searchSchema,
        'Learner',
      );
      console.log('Learner Details', studentDetails);
      if (studentDetails.length == 0) {
        //register in keycloak and then in sunbird rc
        //create keycloak and then login
        const clientToken = await this.keycloakService.getClientToken();
        console.log('clientToken', clientToken);
        if (clientToken?.error) {
          return response.status(401).send({
            success: false,
            status: 'keycloak_client_token_error',
            message: 'System Authentication Failed ! Please Try Again.',
            result: null,
          });
        } else {
          ///register in keycloak
          let response_text = await this.keycloakService.registerUserKeycloak(
            username,
            password,
            clientToken,
          );
          console.log('registerUserKeycloak', response_text);
          if (response_text?.error) {
            return response.status(400).send({
              success: false,
              status: 'keycloak_register_duplicate',
              message:
                'You entered username Account Already Present in Keycloak.',
              result: null,
            });
          } else {
            //register and create account in sunbird rc
            let inviteSchema = {
              name: name,
              dob: dob,
              gender: gender,
              did: '',
              username: username,
              aadhaar_token: '',
              kyc_aadhaar_token: aadhaar_token,
              recoveryphone: recoveryphone,
            };
            console.log('inviteSchema', inviteSchema);
            let createStudent = await this.sbrcService.sbrcInvite(
              inviteSchema,
              'Learner',
            );
            console.log('createStudent', createStudent);
            if (createStudent) {
              return response.status(200).send({
                success: true,
                status: 'sbrc_register_success',
                message: 'User Account Registered. Complete Aadhar KYC.',
                needkyc: true,
                result: null,
              });
            } else {
              //need to add rollback function for keycloak user delete
              let response_text_keycloak =
                await this.keycloakService.deleteUserKeycloak(
                  username,
                  clientToken,
                );
              if (response_text_keycloak?.error) {
                return response.status(400).send({
                  success: false,
                  status: 'sbrc_invite_error_delete_keycloak',
                  message: 'Unable to Register Learner. Try Again.',
                  result: null,
                });
              } else {
                return response.status(400).send({
                  success: false,
                  status: 'sbrc_invite_error',
                  message: 'Unable to Register Learner. Try Again.',
                  result: null,
                });
              }
            }
          }
        }
      } else if (studentDetails.length > 0) {
        if (studentDetails[0].username != '') {
          return response.status(400).send({
            success: false,
            status: 'sbrc_register_duplicate',
            message: `You entered account details already linked to an existing Keycloak account, which has a username ${studentDetails[0].username}. You cannot set a new username for this account detail. Login using the linked username and password.`,
            result: null,
          });
        } else {
          //register in keycloak and then update username
          //register in keycloak
          //create keycloak and then login
          const clientToken = await this.keycloakService.getClientToken();
          if (clientToken?.error) {
            return response.status(401).send({
              success: false,
              status: 'keycloak_client_token_error',
              message: 'System Authentication Failed ! Please Try Again.',
              result: null,
            });
          } else {
            ///register in keycloak
            let response_text = await this.keycloakService.registerUserKeycloak(
              username,
              password,
              clientToken,
            );
            if (response_text?.error) {
              return response.status(400).send({
                success: false,
                status: 'keycloak_register_duplicate',
                message:
                  'You entered username Account Already Present in Keycloak.',
                result: null,
              });
            } else {
              //update username and register in keycloak
              //update username
              let updateRes = await this.sbrcService.sbrcUpdate(
                { username: username, kyc_aadhaar_token: aadhaar_token },
                'Learner',
                studentDetails[0].osid,
              );
              if (updateRes) {
                if (studentDetails[0].kyc_aadhaar_token == '') {
                  return response.status(200).send({
                    success: true,
                    status: 'sbrc_register_success',
                    message: 'User Account Registered. Complete Aadhar KYC.',
                    needkyc: true,
                    result: null,
                  });
                } else {
                  return response.status(200).send({
                    success: true,
                    status: 'sbrc_register_success',
                    message:
                      'User Account Registered. Login using username and password.',
                    result: null,
                  });
                }
              } else {
                //need to add rollback function for keycloak user delete
                let response_text_keycloak =
                  await this.keycloakService.deleteUserKeycloak(
                    username,
                    clientToken,
                  );
                if (response_text_keycloak?.error) {
                  return response.status(400).send({
                    success: false,
                    status: 'sbrc_invite_error_delete_keycloak',
                    message: 'Unable to Register Learner. Try Again.',
                    result: null,
                  });
                } else {
                  return response.status(200).send({
                    success: false,
                    status: 'sbrc_update_error',
                    message:
                      'Unable to Update Learner Username ! Please Try Again.',
                    result: null,
                  });
                }
              }
            }
          }
        }
      } else {
        return response.status(200).send({
          success: false,
          status: 'sbrc_search_error',
          message: 'Unable to search Learner. Try Again.',
          result: null,
        });
      }
    } else {
      return response.status(400).send({
        success: false,
        status: 'invalid_request',
        message: 'Invalid Request. Not received All Parameters.',
        result: null,
      });
    }
  }

  //deprecated function
  //getTokenLogin
  async getTokenLogin(username: string, password: string, response: Response) {
    let qs = require('qs');
    if (username && password) {
      let data = qs.stringify({
        client_id: 'registry-frontend',
        username: username,
        password: password,
        grant_type: 'password',
      });
      const url =
        process.env.KEYCLOAK_URL +
        'realms/sunbird-rc/protocol/openid-connect/token';
      const config: AxiosRequestConfig = {
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
        },
      };
      let keycloak_response = null;
      try {
        const observable = this.httpService.post(url, data, config);
        const promise = observable.toPromise();
        const response = await promise;
        //console.log(JSON.stringify(response.data));
        keycloak_response = response.data;
      } catch (e) {
        //console.log(e);
        //keycloak_response = { error: e };
      }
      if (keycloak_response == null) {
        return response.status(400).send({
          success: false,
          status: 'keycloak_error',
          message: 'Error in Authentication',
          result: null,
        });
      } else {
        return response.status(200).send({
          success: true,
          status: 'request_success',
          message: 'Success',
          result: keycloak_response?.access_token
            ? keycloak_response.access_token
            : '',
        });
      }
    } else {
      return response.status(400).send({
        success: false,
        status: 'invalid_request',
        message: 'Invalid Request. Not received All Parameters.',
        result: null,
      });
    }
  }

  //getUploadFiles
  async getUploadFiles(
    token: string,
    type: string,
    issuerDetail: any,
    vcData: any,
    credentialSubjectCommon: any,
    csvfile: Express.Multer.File,
    response: Response,
  ) {
    if (token && issuerDetail && vcData && credentialSubjectCommon && csvfile) {
      let jwt_decode = await this.parseJwt(token);
      let roles = jwt_decode?.realm_access?.roles
        ? jwt_decode.realm_access.roles
        : [];
      //check Issuer roles in jwt
      if (roles.includes('Issuer')) {
        //check keycloak token
        const tokenUsername = await this.keycloakService.verifyUserToken(token);
        if (tokenUsername?.error) {
          return response.status(401).send({
            success: false,
            status: 'keycloak_token_bad_request',
            message: 'You do not have access for this request.',
            result: null,
          });
        } else if (!tokenUsername?.preferred_username) {
          return response.status(400).send({
            success: false,
            status: 'keycloak_token_error',
            message: 'Your Login Session Expired.',
            result: null,
          });
        } else {
          let issuerDetail_json = null;
          let vcData_json = null;
          let credentialSubjectCommon_json = null;
          try {
            issuerDetail_json = JSON.parse(issuerDetail);
            vcData_json = JSON.parse(vcData);
            credentialSubjectCommon_json = JSON.parse(credentialSubjectCommon);
          } catch (e) {
            issuerDetail_json = issuerDetail;
            vcData_json = vcData;
            credentialSubjectCommon_json = credentialSubjectCommon;
          }
          console.log('issuerDetail_json', issuerDetail_json);
          let schemaId = '';
          if (type === 'proofOfAssessment') {
            schemaId = process.env.PROOF_OF_ASSESSMENT;
          }
          if (type === 'proofOfEnrollment') {
            schemaId = process.env.PROOF_OF_ENROLLMENT;
          }
          if (type === 'proofOfBenifits') {
            schemaId = process.env.PROOF_OF_BENIFIT;
          }
          const stream = Readable.from(csvfile.buffer);
          let payload_data = new Object();
          payload_data['issuerDetail'] = issuerDetail_json;
          payload_data['vcData'] = vcData_json;
          payload_data['credentialSubjectCommon'] =
            credentialSubjectCommon_json;
          let csv_data = [];
          let csv_row_index = 0;
          let isvalidcsv = true;
          await new Promise<any>(async (done) => {
            await this.papa.parse(stream, {
              header: false,
              worker: true,
              delimiter: ',',
              step: function (row) {
                if (csv_row_index === 0) {
                } else if (isvalidcsv) {
                  if (type === 'proofOfEnrollment') {
                    csv_data.push({
                      username: row.data[0],
                      student_name: row.data[1],
                      email: row.data[2],
                      contact: row.data[3],
                      student_id: row.data[4],
                      reference_id: row.data[5],
                      guardian_name: row.data[6],
                      enrolled_on: row.data[7],
                      aadhar_token: row.data[8],
                      dob: row.data[9],
                    });
                  }
                  if (type === 'proofOfAssessment') {
                    csv_data.push({
                      username: row.data[0],
                      student_name: row.data[1],
                      email: row.data[2],
                      contact: row.data[3],
                      dob: row.data[4],
                      student_id: row.data[5],
                      reference_id: row.data[6],
                      aadhar_token: row.data[7],
                      marks: row.data[8],
                    });
                  }
                  //console.log('Row: ', row.data);
                }
                csv_row_index++;
              },
              complete: function () {
                //console.log('Loaded Node Data!');
                done(csv_data);
              },
            });
          });
          payload_data['credentialSubject'] = csv_data;
          //register and issue credentials
          await this.bulkRegisterCredentials(
            type,
            payload_data,
            schemaId,
            response,
          );
          //console.log(csv_data);
          /*return response.status(200).send({
                      success: true,
                      status: 'file_receive',
                      message: 'File Received',
                      result: payload_data,
                    });*/
        }
      } else {
        return response.status(400).send({
          success: false,
          status: 'invalid_request',
          message: 'Invalid Keycloak Token',
          result: null,
        });
      }
    } else {
      return response.status(400).send({
        success: false,
        status: 'invalid_request',
        message: 'Invalid Request. Not received All Parameters.',
        result: null,
      });
    }
  }

  //bulk register and credentials issue
  async bulkRegisterCredentials(
    type: string,
    payload_data: any,
    schemaId: string,
    response: Response,
  ) {
    if (type && payload_data && schemaId) {
      //register bulk student
      var issuerId = payload_data.issuerDetail.did;
      //generate schema
      var schemaRes = await this.credService.generateSchema(schemaId);
      //console.log('schemaRes', schemaRes);
      if (schemaRes) {
        //error log report
        let iserror = false;
        let loglist = [];
        let error_count = 0;
        let success_count = 0;
        let i_count = 0;

        var responseArray = [];

        // bulk import
        for (const iterator of payload_data.credentialSubject) {
          loglist[i_count] = {};
          loglist[i_count].studentDetails = iterator;

          try {
            if (payload_data.credentialSubjectCommon.grade) {
              iterator.grade = payload_data.credentialSubjectCommon.grade;
            }
            if (payload_data.credentialSubjectCommon.academic_year) {
              iterator.academic_year =
                payload_data.credentialSubjectCommon.academic_year;
            }
            if (payload_data.credentialSubjectCommon.benefitProvider) {
              iterator.benefitProvider =
                payload_data.credentialSubjectCommon.benefitProvider;
            }
            if (payload_data.credentialSubjectCommon.schemeName) {
              iterator.schemeName =
                payload_data.credentialSubjectCommon.schemeName;
            }
            if (payload_data.credentialSubjectCommon.schemeId) {
              iterator.schemeId = payload_data.credentialSubjectCommon.schemeId;
            }
            if (payload_data.credentialSubjectCommon.assessment) {
              iterator.assessment =
                payload_data.credentialSubjectCommon.assessment;
            }
            if (payload_data.credentialSubjectCommon.quarterlyAssessment) {
              iterator.quarterlyAssessment =
                payload_data.credentialSubjectCommon.quarterlyAssessment;
            }
            if (payload_data.credentialSubjectCommon.total) {
              iterator.total = payload_data.credentialSubjectCommon.total;
            }
            //list of schema update fields
            if (payload_data.issuerDetail.schoolName) {
              iterator.school_name = payload_data.issuerDetail.schoolName;
            }
            if (payload_data.issuerDetail.schoolid) {
              iterator.school_id = payload_data.issuerDetail.schoolid;
            }

            // find student
            let username = iterator.username;
            let searchSchema = {
              filters: {
                username: {
                  eq: username,
                },
              },
            };
            const studentDetails = await this.sbrcService.sbrcSearch(
              searchSchema,
              'Learner',
            );
            //console.log('studentDetails', studentDetails);
            if (studentDetails.length > 0) {
              if (studentDetails[0]?.did) {
                iterator.id = studentDetails[0].did;
                let obj = {
                  issuerId: issuerId,
                  credSchema: schemaRes,
                  credentialSubject: iterator,
                  issuanceDate: payload_data.vcData.issuanceDate,
                  expirationDate: payload_data.vcData.expirationDate,
                };
                //console.log('obj', obj);

                const cred = await this.credService.issueCredentials(obj);
                //console.log("cred 34", cred)
                if (cred) {
                  responseArray.push(cred);
                  loglist[i_count].status = true;
                  loglist[i_count].error = {};
                  success_count++;
                } else {
                  responseArray.push({
                    error: 'unable to issue credentials!',
                  });
                  iserror = true;
                  loglist[i_count].status = false;
                  loglist[i_count].error =
                    'Unable to Issue Credentials ! Please Try Again.';
                  //loglist[i_count].errorlog = {};
                  error_count++;
                }
              } else {
                let didRes = await this.credService.generateDid(username);

                if (didRes) {
                  iterator.id = didRes[0].verificationMethod[0].controller;
                  let updateRes = await this.sbrcService.sbrcUpdate(
                    { did: iterator.id },
                    'Learner',
                    studentDetails[0].osid,
                  );
                  if (updateRes) {
                    let obj = {
                      issuerId: issuerId,
                      credSchema: schemaRes,
                      credentialSubject: iterator,
                      issuanceDate: payload_data.vcData.issuanceDate,
                      expirationDate: payload_data.vcData.expirationDate,
                    };
                    //console.log('obj', obj);

                    if (iterator.id) {
                      const cred = await this.credService.issueCredentials(obj);
                      //console.log("cred 34", cred)
                      if (cred) {
                        responseArray.push(cred);
                        loglist[i_count].status = true;
                        loglist[i_count].error = {};
                        success_count++;
                      } else {
                        responseArray.push({
                          error: 'unable to issue credentials!',
                        });
                        iserror = true;
                        loglist[i_count].status = false;
                        loglist[i_count].error =
                          'Unable to Issue Credentials ! Please Try Again.';
                        //loglist[i_count].errorlog = {};
                        error_count++;
                      }
                    }
                  } else {
                    responseArray.push({
                      error: 'unable to update did inside RC!',
                    });
                    iserror = true;
                    loglist[i_count].status = false;
                    loglist[i_count].error =
                      'Unable to Update Student Identity ! Please Try Again.';
                    //loglist[i_count].errorlog = {};
                    error_count++;
                  }
                } else {
                  responseArray.push({
                    error: 'unable to generate student did!',
                  });
                  iserror = true;
                  loglist[i_count].status = false;
                  loglist[i_count].error =
                    'Unable to Generate Student DID ! Please Try Again.';
                  //loglist[i_count].errorlog = {};
                  error_count++;
                }
              }
            } else {
              let didRes = await this.credService.generateDid(username);

              if (didRes) {
                iterator.id = didRes[0].verificationMethod[0].controller;
                let inviteSchema = {
                  name: iterator.name,
                  did: iterator.id,
                  username: iterator.username,
                  email: iterator.email,
                  contact: iterator.contact,
                };
                //console.log('inviteSchema', inviteSchema);
                let createStudent = await this.sbrcService.sbrcInvite(
                  inviteSchema,
                  'Learner',
                );
                //console.log('createStudent', createStudent);

                if (createStudent) {
                  let obj = {
                    issuerId: issuerId,
                    credSchema: schemaRes,
                    credentialSubject: iterator,
                    issuanceDate: payload_data.vcData.issuanceDate,
                    expirationDate: payload_data.vcData.expirationDate,
                  };
                  //console.log('obj', obj);

                  const cred = await this.credService.issueCredentials(obj);
                  //console.log("cred 34", cred)
                  if (cred) {
                    responseArray.push(cred);
                    loglist[i_count].status = true;
                    loglist[i_count].error = {};
                    success_count++;
                  } else {
                    responseArray.push({
                      error: 'unable to issue credentials!',
                    });
                    iserror = true;
                    loglist[i_count].status = false;
                    loglist[i_count].error =
                      'Unable to Issue Credentials ! Please Try Again.';
                    //loglist[i_count].errorlog = {};
                    error_count++;
                  }
                } else {
                  responseArray.push({
                    error: 'unable to create student in RC!',
                  });
                  iserror = true;
                  loglist[i_count].status = false;
                  loglist[i_count].error =
                    'Unable to Create Student Account ! Please Try Again.';
                  //loglist[i_count].errorlog = {};
                  error_count++;
                }
              } else {
                responseArray.push({
                  error: 'unable to generate student did!',
                });
                iserror = true;
                loglist[i_count].status = false;
                loglist[i_count].error =
                  'Unable to Generate Student DID ! Please Try Again.';
                //loglist[i_count].errorlog = {};
                error_count++;
              }
            }
          } catch (e) {
            //console.log(e);
            iserror = true;
            loglist[i_count].status = false;
            loglist[i_count].error = 'System Exception ! Please Try Again.';
            loglist[i_count].errorlog = JSON.stringify(e);
            error_count++;
          }
          i_count++;
        }
        return response.status(200).send({
          success: true,
          status: 'student_bulk_upload_api_success',
          iserror: iserror,
          message: 'Student Bulk Upload API Success.',
          error_count: error_count,
          success_count: success_count,
          result: loglist,
        });
      } else {
        return response.status(200).send({
          success: false,
          status: 'did_cred_generate_error',
          message:
            'User Identity and Credentials Generation Failed. Try Again.',
          result: null,
        });
      }
    } else {
      return response.status(400).send({
        success: false,
        status: 'invalid_request',
        message: 'Invalid Request. Not received All Parameters.',
        result: null,
      });
    }
  }

  //helper function
  //get jwt token information
  parseJwt = async (token): Promise<any> => {
    if (!token) {
      return {};
    }
    const decoded = jwt_decode(token);
    return decoded;
  };

  async issueBulkCredential(
    credentialPlayload: any,
    schemaId: string,
    type: string,
    response: Response,
  ) {
    console.log('credentialPlayload: ', credentialPlayload);
    console.log('schemaId: ', schemaId);

    var credentialSubject = await this.credentialSubjectData(type);
    credentialPlayload.credentialSubject = credentialSubject;

    console.log('credentialPlayload: 663', credentialPlayload);

    var issuerId = '';

    // find or create issuerId
    //find udise in rc
    let searchSchema = {
      filters: {
        udiseCode: {
          eq: credentialPlayload.issuerDetail.udise,
        },
      },
    };
    //let searchSchoolDetail = await this.sbrcSearch(searchSchema, 'SchoolDetail')
    let searchSchoolDetail = await this.sbrcService.sbrcSearch(
      searchSchema,
      'SchoolDetail',
    );
    console.log('searchSchoolDetail', searchSchoolDetail);

    if (searchSchoolDetail.length > 0) {
      issuerId = searchSchoolDetail[0].did;
      console.log('issuerId', issuerId);
    } else {
      //let schoolDidRes = await this.generateDid(credentialPlayload.issuerDetail.udise)
      let schoolDidRes = await this.credService.generateDid(
        credentialPlayload.issuerDetail.udise,
      );
      console.log('schoolDidRes', schoolDidRes);

      if (schoolDidRes) {
        credentialPlayload.issuerDetail.schoolDid =
          schoolDidRes[0].verificationMethod[0].controller;
        //create schoolDetail in rc

        let inviteSchema = {
          schoolName: credentialPlayload.issuerDetail.schoolName,
          udiseCode: credentialPlayload.issuerDetail.udise,
          did: credentialPlayload.issuerDetail.schoolDid,
        };
        //let createSchoolDetail = await this.sbrcInvite(inviteSchema, 'SchoolDetail')
        let createSchoolDetail = await this.sbrcService.sbrcInvite(
          inviteSchema,
          'SchoolDetail',
        );
        console.log('createSchoolDetail', createSchoolDetail);

        if (createSchoolDetail) {
          issuerId = credentialPlayload.issuerDetail.schoolDid;
          console.log('issuerId', issuerId);
        } else {
          return response.status(200).send({
            success: false,
            status: 'sb_rc_register_error',
            message: 'System Register Error ! Please try again.',
            result: null,
          });
        }
      } else {
        return response.status(200).send({
          success: false,
          status: 'did_generate_error',
          message: 'Identity Generation Failed ! Please Try Again.',
          result: null,
        });
      }
    }

    //generate schema
    //var schemaRes = await this.generateSchema(schemaId);
    var schemaRes = await this.credService.generateSchema(schemaId);
    console.log('schemaRes', schemaRes);

    if (schemaRes) {
      var responseArray = [];

      // bulk import
      for (let iterator of credentialPlayload.credentialSubject) {
        if (credentialPlayload.credentialSubjectCommon.grade) {
          iterator.grade = credentialPlayload.credentialSubjectCommon.grade;
        }
        if (credentialPlayload.credentialSubjectCommon.academic_year) {
          iterator.academic_year =
            credentialPlayload.credentialSubjectCommon.academic_year;
        }
        if (credentialPlayload.credentialSubjectCommon.benefitProvider) {
          iterator.benefitProvider =
            credentialPlayload.credentialSubjectCommon.benefitProvider;
        }
        if (credentialPlayload.credentialSubjectCommon.schemeName) {
          iterator.schemeName =
            credentialPlayload.credentialSubjectCommon.schemeName;
        }
        if (credentialPlayload.credentialSubjectCommon.schemeId) {
          iterator.schemeId =
            credentialPlayload.credentialSubjectCommon.schemeId;
        }
        if (credentialPlayload.credentialSubjectCommon.assessment) {
          iterator.assessment =
            credentialPlayload.credentialSubjectCommon.assessment;
        }
        if (credentialPlayload.credentialSubjectCommon.quarterlyAssessment) {
          iterator.quarterlyAssessment =
            credentialPlayload.credentialSubjectCommon.quarterlyAssessment;
        }
        if (credentialPlayload.credentialSubjectCommon.total) {
          iterator.total = credentialPlayload.credentialSubjectCommon.total;
        }
        //list of schema update fields
        if (credentialPlayload.issuerDetail.schoolName) {
          iterator.school_name = credentialPlayload.issuerDetail.schoolName;
        }
        if (credentialPlayload.issuerDetail.udise) {
          iterator.school_id = credentialPlayload.issuerDetail.udise;
        }
        if (credentialPlayload.credentialSubjectCommon.stateCode) {
          iterator.stateCode =
            credentialPlayload.credentialSubjectCommon.stateCode;
        }
        if (credentialPlayload.credentialSubjectCommon.stateName) {
          iterator.stateName =
            credentialPlayload.credentialSubjectCommon.stateName;
        }
        if (credentialPlayload.credentialSubjectCommon.districtCode) {
          iterator.districtCode =
            credentialPlayload.credentialSubjectCommon.districtCode;
        }
        if (credentialPlayload.credentialSubjectCommon.districtName) {
          iterator.districtName =
            credentialPlayload.credentialSubjectCommon.districtName;
        }
        if (credentialPlayload.credentialSubjectCommon.blockCode) {
          iterator.blockCode =
            credentialPlayload.credentialSubjectCommon.blockCode;
        }
        if (credentialPlayload.credentialSubjectCommon.blockName) {
          iterator.blockName =
            credentialPlayload.credentialSubjectCommon.blockName;
        }

        //generate did or find did
        var aadhar_token = iterator.aadhar_token;

        // find student
        let name = iterator.student_name;
        let dob = iterator.dob;
        let searchSchema = {
          filters: {
            student_name: {
              eq: name,
            },
            dob: {
              eq: dob,
            },
          },
        };
        //const studentDetails = await this.sbrcSearch(searchSchema, 'StudentV2')
        const studentDetails = await this.sbrcService.sbrcSearch(
          searchSchema,
          'StudentV2',
        );
        console.log('studentDetails', studentDetails);

        if (studentDetails.length > 0) {
          if (studentDetails[0]?.DID) {
            iterator.id = studentDetails[0].DID;
            let obj = {
              issuerId: issuerId,
              credSchema: schemaRes,
              credentialSubject: iterator,
              issuanceDate: credentialPlayload.vcData.issuanceDate,
              expirationDate: credentialPlayload.vcData.expirationDate,
            };
            console.log('obj', obj);

            //const cred = await this.issueCredentials(obj)
            const cred = await this.credService.issueCredentials(obj);
            //console.log("cred 34", cred)
            if (cred) {
              responseArray.push(cred);

              //telemetry service called
              this.telemetryService.telemetry({
                id: iterator.id,
                student_name: iterator.student_name,
                dob: iterator.dob,
                type: type,
                result: 'credentials-issued',
              });
            } else {
              responseArray.push({
                student_name: iterator.student_name,
                dob: iterator.dob,
                error: 'unable to issue credentials!',
              });
              //telemetry service called
              this.telemetryService.telemetry({
                id: iterator.id,
                student_name: iterator.student_name,
                dob: iterator.dob,
                type: type,
                result: 'credentials-failed',
              });
            }
          } else {
            //let didRes = await this.generateDid(aadhar_token)
            let didRes = await this.credService.generateDid(aadhar_token);

            if (didRes) {
              iterator.id = didRes[0].verificationMethod[0].controller;
              //let updateRes = await this.sbrcUpdate({ DID: iterator.id }, 'StudentV2', studentDetails[0].osid)
              let updateRes = await this.sbrcService.sbrcUpdate(
                { DID: iterator.id },
                'StudentV2',
                studentDetails[0].osid,
              );
              if (updateRes) {
                let obj = {
                  issuerId: issuerId,
                  credSchema: schemaRes,
                  credentialSubject: iterator,
                  issuanceDate: credentialPlayload.vcData.issuanceDate,
                  expirationDate: credentialPlayload.vcData.expirationDate,
                };
                console.log('obj', obj);

                if (iterator.id) {
                  //const cred = await this.issueCredentials(obj)
                  const cred = await this.credService.issueCredentials(obj);
                  //console.log("cred 34", cred)
                  if (cred) {
                    responseArray.push(cred);
                    //telemetry service called
                    this.telemetryService.telemetry({
                      id: iterator.id,
                      student_name: iterator.student_name,
                      dob: iterator.dob,
                      type: type,
                      result: 'credentials-issued',
                    });
                  } else {
                    responseArray.push({
                      student_name: iterator.student_name,
                      dob: iterator.dob,
                      error: 'unable to issue credentials!',
                    });

                    //telemetry service called
                    this.telemetryService.telemetry({
                      id: iterator.id,
                      student_name: iterator.student_name,
                      dob: iterator.dob,
                      type: type,
                      result: 'credentials-failed',
                    });
                  }
                }
              } else {
                responseArray.push({
                  student_name: iterator.student_name,
                  dob: iterator.dob,
                  error: 'unable to update did inside RC!',
                });
                //telemetry service called
                this.telemetryService.telemetry({
                  id: iterator.id,
                  student_name: iterator.student_name,
                  dob: iterator.dob,
                  type: type,
                  result: 'credentials-failed',
                });
              }
            } else {
              responseArray.push({
                student_name: iterator.student_name,
                dob: iterator.dob,
                error: 'unable to generate student did!',
              });

              //telemetry service called
              this.telemetryService.telemetry({
                id: iterator.id,
                student_name: iterator.student_name,
                dob: iterator.dob,
                type: type,
                result: 'credentials-failed',
              });
            }
          }
        } else {
          //let didRes = await this.generateDid(aadhar_token)
          console.log('iterator 995', iterator);
          console.log('aadhar_token', aadhar_token);
          console.log('iterator.student_name', iterator.student_name);
          if (aadhar_token) {
            let didRes = await this.credService.generateDid(aadhar_token);

            if (didRes) {
              iterator.id = didRes[0].verificationMethod[0].controller;
              var user_name;
              if (iterator.student_name.includes(' ')) {
                user_name = (
                  iterator.student_name.split(' ')[0] +
                  '@' +
                  iterator.dob.split('/').join('')
                ).toLowerCase();
              } else {
                user_name = (
                  iterator.student_name +
                  '@' +
                  iterator.dob.split('/').join('')
                ).toLowerCase();
              }

              let inviteSchema = {
                student_id: iterator.student_id,
                DID: iterator.id,
                reference_id: iterator.reference_id,
                aadhar_token: iterator.aadhar_token,
                student_name: iterator.student_name,
                dob: iterator.dob,
                school_type: 'public',
                meripehchan_id: '',
                username: user_name,
                aadhaar_status: 'verified',
                aadhaar_enc: '',
                gender: iterator?.gender ? iterator.gender : '',
                school_udise: iterator.school_id,
                school_name: iterator.school_name,
                stateCode: iterator.stateCode,
                stateName: iterator.stateName,
                districtCode: iterator.districtCode,
                districtName: iterator.districtName,
                blockCode: iterator.blockCode,
                blockName: iterator.blockName,
              };
              console.log('inviteSchema', inviteSchema);
              //let createStudent = await this.sbrcInvite(inviteSchema, 'StudentV2')
              let createStudent = await this.sbrcService.sbrcInvite(
                inviteSchema,
                'StudentV2',
              );
              console.log('createStudent', createStudent);

              if (createStudent) {
                let obj = {
                  issuerId: issuerId,
                  credSchema: schemaRes,
                  credentialSubject: iterator,
                  issuanceDate: credentialPlayload.vcData.issuanceDate,
                  expirationDate: credentialPlayload.vcData.expirationDate,
                };
                console.log('obj', obj);

                //const cred = await this.issueCredentials(obj)
                const cred = await this.credService.issueCredentials(obj);
                //console.log("cred 34", cred)
                if (cred) {
                  responseArray.push(cred);
                  //telemetry service called
                  this.telemetryService.telemetry({
                    id: iterator.id,
                    student_name: iterator.student_name,
                    dob: iterator.dob,
                    type: type,
                    result: 'credentials-issued',
                  });
                } else {
                  responseArray.push({
                    student_name: iterator.student_name,
                    dob: iterator.dob,
                    error: 'unable to issue credentials!',
                  });

                  //telemetry service called
                  this.telemetryService.telemetry({
                    id: iterator.id,
                    student_name: iterator.student_name,
                    dob: iterator.dob,
                    type: type,
                    result: 'credentials-failed',
                  });
                }
              } else {
                responseArray.push({
                  student_name: iterator.student_name,
                  dob: iterator.dob,
                  error: 'unable to create student in RC!',
                });

                //telemetry service called
                this.telemetryService.telemetry({
                  id: iterator.id,
                  student_name: iterator.student_name,
                  dob: iterator.dob,
                  type: type,
                  result: 'credentials-failed',
                });
              }
            } else {
              responseArray.push({
                student_name: iterator.student_name,
                dob: iterator.dob,
                error: 'unable to generate student did!',
              });

              //telemetry service called
              this.telemetryService.telemetry({
                id: iterator.id,
                student_name: iterator.student_name,
                dob: iterator.dob,
                type: type,
                result: 'credentials-failed',
              });
            }
          } else {
            responseArray.push({
              student_name: iterator.student_name,
              dob: iterator.dob,
              error: 'aadhar_token not found!',
            });

            //telemetry service called
            this.telemetryService.telemetry({
              id: iterator.id,
              student_name: iterator.student_name,
              dob: iterator.dob,
              type: type,
              result: 'credentials-failed',
            });
          }
        }
      }

      //bulk import response
      console.log('responseArray.length', responseArray.length);
      if (responseArray.length > 0) {
        return response.status(200).send({
          success: true,
          status: 'student_cred_bulk_api_success',
          message: 'Student Cred Bulk API Success.',
          result: responseArray,
        });
      } else {
        return response.status(200).send({
          success: false,
          status: 'did_cred_generate_error',
          message:
            'User Identity and Credentials Generation Failed. Try Again.',
          result: null,
        });
      }
    } else {
      return response.status(200).send({
        success: false,
        status: 'did_cred_generate_error',
        message: 'User Identity and Credentials Generation Failed. Try Again.',
        result: null,
      });
    }
  }

  async credentialSubjectData(type) {
    console.log('type', type);
    var users;
    var credSubject = [];
    if (type === 'proofOfAssessment') {
      users = await this.usersService.findAllAssesment();

      console.log('users', users);

      for (let iterator of users) {
        console.log('iterator 1124', iterator);
        iterator = JSON.parse(JSON.stringify(iterator));
        console.log('iterator 1126', iterator);
        let assesmentObj = {
          student_id: iterator.Id,
          student_name: iterator.name,
          dob: '29/12/1990',
          reference_id: iterator.ref_id,
          aadhar_token: 'qwrycvqwtqw3674',
          marks: iterator.marks,
        };
        credSubject.push(assesmentObj);
      }
    }
    if (type === 'proofOfEnrollment') {
      users = await this.usersService.findAllEnrollment();

      console.log('users', users);

      for (let iterator of users) {
        console.log('iterator 1124', iterator);
        iterator = JSON.parse(JSON.stringify(iterator));
        console.log('iterator 1126', iterator);
        let enrollmentObj = {
          student_id: iterator?.Id,
          student_name: iterator?.name,
          dob: iterator?.age,
          reference_id: iterator?.ref_id,
          aadhar_token: 'qwrycvqwtqw3674',
          guardian_name: iterator?.fname,
          enrolled_on: '2022-02-06',
        };
        credSubject.push(enrollmentObj);
      }
    }
    if (type === 'proofOfBenifits') {
      users = await this.usersService.findAllBenefit();

      console.log('users', users);

      for (let iterator of users) {
        console.log('iterator 1124', iterator);
        iterator = JSON.parse(JSON.stringify(iterator));
        console.log('iterator 1126', iterator);
        let benefitObj = {
          student_id: iterator?.Id,
          student_name: iterator?.name,
          dob: '29/12/1990',
          reference_id: iterator?.ref_id,
          aadhar_token: 'qwrycvqwtqw3674',
          guardian_name: 'Sita prabhu',
          enrolled_on: '2023-06-06',
          transactionId: iterator?.transaction_id,
          transactionAmount: iterator?.transaction_amount,
          deliveryDate: '16-07-2022',
        };
        credSubject.push(benefitObj);
      }
    }
    console.log('credSubject', credSubject);
    return credSubject;
  }
}
